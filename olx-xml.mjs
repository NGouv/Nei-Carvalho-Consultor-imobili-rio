const PROPERTY_VIDEO_MARKER = "__NEI_CARVALHO_PROPERTY_VIDEO__:";

const SUBTYPES = new Map([
  ["apartamento", "Apartamento"],
  ["casa", "Casa"],
  ["terreno", "Terreno"],
  ["comercial", "Comercial"]
]);

const APARTMENT_FEATURE_TAGS = new Map([
  ["ar condicionado", "ArCondicionado"],
  ["academia", "SalaGinastica"],
  ["sala de ginastica", "SalaGinastica"],
  ["armario embutido", "ArmarioEmbutido"],
  ["armarios embutidos", "ArmarioEmbutido"],
  ["varanda", "Varanda"],
  ["area de servico", "AreaServico"],
  ["churrasqueira", "Churrasqueira"],
  ["quarto e wc de empregada", "QuartoWCEmpregada"],
  ["quarto e banheiro de empregada", "QuartoWCEmpregada"],
  ["piscina", "Piscina"],
  ["salao de festas", "SalaoFestas"],
  ["porteiro", "Porteiro"]
]);

function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function cleanDescription(value) {
  return cleanText(value).replace(/<\/?[^>]+>/g, " ").trim();
}

function propertySubtype(property) {
  return SUBTYPES.get(normalized(property.property_type)) || "";
}

export function getOlxPropertyIssues(property) {
  const issues = [];
  const cep = String(property.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) issues.push("CEP obrigatório");
  if (!cleanDescription(property.description)) issues.push("descrição obrigatória");
  if (!propertySubtype(property)) issues.push("tipo de imóvel sem mapeamento OLX");
  return issues;
}

function xmlSafe(value) {
  return String(value || "").replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "");
}

function escapeXml(value) {
  return xmlSafe(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[character]);
}

function tag(name, value) {
  return `            <${name}>${escapeXml(value)}</${name}>`;
}

function boundedCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(5, Math.max(0, Math.floor(count))) : 0;
}

function integerValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function imageUrl(baseUrl, propertyId, imageId) {
  const url = new URL("/api/olx-image", baseUrl);
  url.searchParams.set("propertyId", propertyId);
  url.searchParams.set("imageId", imageId);
  return url.href;
}

function apartmentFeatureTags(features) {
  const tags = new Set();
  for (const feature of Array.isArray(features) ? features : []) {
    if (typeof feature !== "string" || feature.startsWith(PROPERTY_VIDEO_MARKER)) continue;
    const tagName = APARTMENT_FEATURE_TAGS.get(normalized(feature));
    if (tagName) tags.add(tagName);
  }
  return Array.from(tags, (name) => tag(name, "1"));
}

function youtubeVideo(features) {
  const marker = (Array.isArray(features) ? features : [])
    .find((feature) => typeof feature === "string" && feature.startsWith(PROPERTY_VIDEO_MARKER));
  if (!marker) return "";

  try {
    const url = new URL(marker.slice(PROPERTY_VIDEO_MARKER.length));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    const host = url.hostname.toLowerCase();
    const allowedHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);
    if (!allowedHosts.has(host)) return "";
    const id = host.endsWith("youtu.be")
      ? url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
      : url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return "";
    return `https://www.youtube.com/watch?v=${id}`;
  } catch {
    return "";
  }
}

function observation(property) {
  const features = (Array.isArray(property.features) ? property.features : [])
    .filter((feature) => typeof feature === "string" && !feature.startsWith(PROPERTY_VIDEO_MARKER))
    .map(cleanText)
    .filter(Boolean);
  const parts = [cleanDescription(property.description)];
  if (features.length) parts.push(`Características: ${features.join(", ")}`);
  return Array.from(parts.join("\n")).slice(0, 6000).join("").replace(/\n/g, "\\n");
}

function propertyXml(property, baseUrl) {
  const subtype = propertySubtype(property);
  const propertyId = String(property.id);
  const code = propertyId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const images = (Array.isArray(property.property_images) ? property.property_images : [])
    .filter((image) => image && image.id && image.olx_ready === true)
    .slice()
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary))
      || Number(left.display_order || 0) - Number(right.display_order || 0));
  const lines = [
    "        <Imovel>",
    tag("CodigoImovel", code)
  ];

  const title = cleanText(property.title);
  if (title) lines.push(tag("TituloAnuncio", Array.from(title).slice(0, 90).join("")));
  lines.push(tag("SubTipoImovel", subtype));
  if (property.city) lines.push(tag("Cidade", cleanText(property.city)));
  if (property.neighborhood) lines.push(tag("Bairro", cleanText(property.neighborhood)));
  lines.push(tag("CEP", String(property.cep).replace(/\D/g, "")));

  const price = integerValue(property.price);
  if (price !== null) lines.push(tag(property.purpose === "rent" ? "PrecoLocacao" : "PrecoVenda", price));
  const condominium = integerValue(property.condominium);
  if (property.condominium !== null && property.condominium !== undefined && condominium !== null) {
    lines.push(tag("PrecoCondominio", condominium));
  }
  const totalArea = integerValue(property.total_area);
  if (totalArea > 0) lines.push(tag("AreaTotal", totalArea));

  if (subtype === "Apartamento" || subtype === "Casa") {
    lines.push(tag("QtdDormitorios", boundedCount(property.bedrooms)));
    lines.push(tag("QtdBanheiros", boundedCount(property.bathrooms)));
    lines.push(tag("QtdVagas", boundedCount(property.parking)));
  } else if (subtype === "Comercial") {
    lines.push(tag("QtdVagas", boundedCount(property.parking)));
  }

  lines.push(tag("Observacao", observation(property)));
  if (subtype === "Apartamento") lines.push(...apartmentFeatureTags(property.features));

  const video = youtubeVideo(property.features);
  if (video) lines.push(`            <Videos><Video>${escapeXml(video)}</Video></Videos>`);

  if (images.length) {
    lines.push("            <Fotos>");
    images.forEach((image, index) => {
      lines.push("                <Foto>");
      if (image.is_primary || (!images.some((item) => item.is_primary) && index === 0)) {
        lines.push("                    <Principal>1</Principal>");
      }
      lines.push(`                    <URLArquivo>${escapeXml(imageUrl(baseUrl, propertyId, image.id))}</URLArquivo>`);
      lines.push("                </Foto>");
    });
    lines.push("            </Fotos>");
  }

  lines.push("        </Imovel>");
  return lines.join("\n");
}

export function buildOlxXml(properties, baseUrl) {
  const validProperties = (Array.isArray(properties) ? properties : [])
    .filter((property) => getOlxPropertyIssues(property).length === 0);
  const items = validProperties.map((property) => propertyXml(property, baseUrl)).join("\n");
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    "    <Imoveis>",
    items,
    "    </Imoveis>",
    "</Carga>"
  ].filter((line) => line !== "").join("\n");
}
