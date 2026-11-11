const PROPERTY_VIDEO_MARKER = "__NEI_CARVALHO_PROPERTY_VIDEO__:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION_LENGTH = 6000;

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

function propertyCode(property) {
  return String(property?.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
}

export function getOlxPropertyIssues(property) {
  const issues = [];
  if (!propertyCode(property)) issues.push("código do imóvel obrigatório");
  else if (!UUID_PATTERN.test(String(property.id))) issues.push("identificador do imóvel inválido");
  const cep = String(property.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) issues.push("CEP obrigatório");
  const description = cleanDescription(property.description);
  if (!description) issues.push("descrição obrigatória");
  else if (Array.from(description).length > MAX_DESCRIPTION_LENGTH) {
    issues.push("descrição excede 6000 caracteres");
  }
  else if (Array.from(observation(property)).length > MAX_DESCRIPTION_LENGTH) {
    issues.push("observação excede 6000 caracteres");
  }
  const title = cleanText(property.title);
  if (Array.from(title).length > 90) issues.push("título excede 90 caracteres");
  if (!propertySubtype(property)) issues.push("tipo de imóvel sem mapeamento OLX");
  if (!["sale", "rent"].includes(property.purpose)) issues.push("finalidade do imóvel inválida");
  const price = integerValue(property.price);
  const hasPrice = property.price !== null
    && property.price !== undefined
    && !(typeof property.price === "string" && !property.price.trim());
  if (hasPrice && (price === null || price <= 0)) issues.push("preço inválido");
  if (property.condominium !== null && property.condominium !== undefined
    && integerValue(property.condominium) === null) {
    issues.push("condomínio inválido");
  }
  if (property.total_area !== null && property.total_area !== undefined
    && integerValue(property.total_area) === null) {
    issues.push("área total inválida");
  }
  if (["Apartamento", "Casa"].includes(propertySubtype(property))
    && !validCount(property.bedrooms)) {
    issues.push("quantidade de dormitórios obrigatória ou inválida");
  }
  for (const [field, label] of [["bathrooms", "banheiros"], ["parking", "vagas"]]) {
    if (property[field] !== null && property[field] !== undefined && !validCount(property[field])) {
      issues.push(`quantidade de ${label} inválida`);
    }
  }
  for (const image of Array.isArray(property.property_images) ? property.property_images : []) {
    if (image?.olx_ready === true && !UUID_PATTERN.test(String(image.id || ""))) {
      issues.push("identificador de fotografia inválido");
      break;
    }
  }
  return issues;
}

export function getOlxExportReport(properties) {
  const rejectedProperties = [];
  const validProperties = [];
  const codes = new Map();

  for (const property of Array.isArray(properties) ? properties : []) {
    const issues = getOlxPropertyIssues(property);
    if (issues.length) {
      rejectedProperties.push({ property, issues });
      continue;
    }

    const code = propertyCode(property).toLowerCase();
    const matchingCode = codes.get(code);
    if (matchingCode) {
      const duplicateIssue = "código do imóvel duplicado";
      if (!matchingCode.duplicate) {
        const previous = validProperties.indexOf(matchingCode.property);
        if (previous !== -1) validProperties.splice(previous, 1);
        rejectedProperties.push({ property: matchingCode.property, issues: [duplicateIssue] });
      }
      rejectedProperties.push({ property, issues: [duplicateIssue] });
      matchingCode.duplicate = true;
      continue;
    }

    codes.set(code, { property, duplicate: false });
    validProperties.push(property);
  }

  return { validProperties, rejectedProperties };
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
  return Math.min(5, value);
}

function integerValue(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function validCount(value) {
  return (typeof value === "number" || (typeof value === "string" && Boolean(value.trim())))
    && Number.isInteger(Number(value))
    && Number(value) >= 0;
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
  const description = cleanDescription(property.description);
  const parts = [description];
  for (const feature of features) {
    const addition = `${parts.length > 1 || description ? "\nCaracterísticas: " : ""}${feature}`;
    if (Array.from(parts.join("")).length + Array.from(addition).length > MAX_DESCRIPTION_LENGTH) break;
    if (parts.length === 1 && description) parts.push(`Características: ${feature}`);
    else if (parts.length === 1) parts[0] = feature;
    else parts[parts.length - 1] += `, ${feature}`;
  }
  return parts.join("\n").replace(/\n/g, "\\n");
}

function propertyXml(property, baseUrl) {
  const subtype = propertySubtype(property);
  const propertyId = String(property.id);
  const code = propertyCode(property);
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
  if (title) lines.push(tag("TituloAnuncio", title));
  lines.push(tag("SubTipoImovel", subtype));
  if (cleanText(property.city)) lines.push(tag("Cidade", cleanText(property.city)));
  if (cleanText(property.neighborhood)) lines.push(tag("Bairro", cleanText(property.neighborhood)));
  lines.push(tag("CEP", String(property.cep).replace(/\D/g, "")));

  const price = integerValue(property.price);
  if (price !== null) lines.push(tag(property.purpose === "rent" ? "PrecoLocacao" : "PrecoVenda", price));
  const condominium = integerValue(property.condominium);
  if (condominium !== null) {
    lines.push(tag("PrecoCondominio", condominium));
  }
  const totalArea = integerValue(property.total_area);
  if (totalArea > 0) lines.push(tag("AreaTotal", totalArea));

  if (subtype === "Apartamento" || subtype === "Casa") {
    lines.push(tag("QtdDormitorios", boundedCount(Number(property.bedrooms))));
    if (property.bathrooms !== null && property.bathrooms !== undefined) {
      lines.push(tag("QtdBanheiros", boundedCount(Number(property.bathrooms))));
    }
    if (property.parking !== null && property.parking !== undefined) {
      lines.push(tag("QtdVagas", boundedCount(Number(property.parking))));
    }
  } else if (subtype === "Comercial" && property.parking !== null && property.parking !== undefined) {
    lines.push(tag("QtdVagas", boundedCount(Number(property.parking))));
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
  const { validProperties } = getOlxExportReport(properties);
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
