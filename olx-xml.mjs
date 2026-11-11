const PROPERTY_VIDEO_MARKER = "__NEI_CARVALHO_PROPERTY_VIDEO__:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 90;
const MAX_DESCRIPTION_LENGTH = 3000;
const MIN_DESCRIPTION_LENGTH = 50;
const MIN_IMAGE_COUNT = 5;
const VR_SYNC_NAMESPACE = "http://www.vivareal.com/schemas/1.0/VRSync";
const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
const VR_SYNC_SCHEMA = "http://xml.vivareal.com/vrsync.xsd";

const STATE_NAMES = new Map([
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"]
]);

const PROPERTY_TYPES = new Map([
  ["apartamento", { usage: "Residential", type: "Residential / Apartment", requiresBedrooms: true }],
  ["casa", { usage: "Residential", type: "Residential / Home", requiresBedrooms: true }],
  ["casa de condominio", { usage: "Residential", type: "Residential / Condo", requiresBedrooms: true }],
  ["terreno", { usage: "Residential", type: "Residential / Land", isLand: true }]
]);

const FEATURE_NAMES = new Map([
  ["academia", "Gym"],
  ["ar condicionado", "Cooling"],
  ["area de servico", "Laundry"],
  ["armario embutido", "Builtin Wardrobe"],
  ["armarios embutidos", "Builtin Wardrobe"],
  ["churrasqueira", "BBQ"],
  ["piscina", "Pool"],
  ["salao de festas", "Party Room"],
  ["varanda", "Balcony"]
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

function propertyType(property) {
  return PROPERTY_TYPES.get(normalized(property?.property_type)) || null;
}

function propertyCode(property) {
  return String(property?.id || "");
}

function explicitState(value) {
  const text = cleanText(value);
  if (!text) return null;
  const compact = text.toUpperCase();
  if (/^[A-Z]{2}$/.test(compact) && STATE_NAMES.has(compact)) return compact;
  const match = text.match(/(?:,|\/|\s-\s)\s*([A-Z]{2})$/i);
  if (!match) return null;
  const abbreviation = match[1].toUpperCase();
  return STATE_NAMES.has(abbreviation) ? abbreviation : null;
}

function stateForProperty(property) {
  return explicitState(property?.state)
    || explicitState(property?.address)
    || explicitState(property?.city);
}

function cityName(property) {
  const city = cleanText(property?.city);
  const abbreviation = explicitState(city);
  return abbreviation ? city.replace(/(?:,|\/|\s-\s)\s*[A-Z]{2}$/i, "").trim() : city;
}

function hasValue(value) {
  return value !== null && value !== undefined
    && !(typeof value === "string" && !value.trim());
}

function integerValue(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
}

function validCount(value) {
  return (typeof value === "number" || (typeof value === "string" && Boolean(value.trim())))
    && Number.isInteger(Number(value))
    && Number(value) >= 0;
}

function preparedImages(property) {
  return (Array.isArray(property?.property_images) ? property.property_images : [])
    .filter((image) => image && image.olx_ready === true)
    .slice()
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary))
      || Number(left.display_order || 0) - Number(right.display_order || 0));
}

function descriptionText(property) {
  const description = cleanDescription(property?.description);
  const extraFeatures = (Array.isArray(property?.features) ? property.features : [])
    .filter((feature) => typeof feature === "string" && !feature.startsWith(PROPERTY_VIDEO_MARKER))
    .map(cleanText)
    .filter((feature) => feature && !FEATURE_NAMES.has(normalized(feature)));
  if (!extraFeatures.length) return description;
  return [description, `Características: ${extraFeatures.join(", ")}`].filter(Boolean).join("\n");
}

export function getOlxPropertyIssues(property) {
  const issues = [];
  const code = propertyCode(property);
  if (!code) issues.push("código do imóvel obrigatório");
  else if (!UUID_PATTERN.test(String(property?.id))) issues.push("identificador do imóvel inválido");
  else if (code.length > 50) issues.push("código do imóvel excede 50 caracteres");

  const title = cleanText(property?.title);
  if (Array.from(title).length < 10) issues.push("título deve ter pelo menos 10 caracteres");
  else if (Array.from(title).length > MAX_TITLE_LENGTH) issues.push("título excede 90 caracteres");
  if (/<[^>]+>/.test(title)) issues.push("título não pode conter tags HTML");

  const type = propertyType(property);
  if (!type) issues.push("tipo de imóvel sem mapeamento VRSync");

  if (!["sale", "rent"].includes(property?.purpose)) issues.push("finalidade do imóvel inválida");
  const price = integerValue(property?.price);
  if (!hasValue(property?.price) || price === null || price <= 0) issues.push("preço obrigatório ou inválido");

  const cep = String(property?.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) issues.push("CEP obrigatório");

  if (!cityName(property)) issues.push("cidade obrigatória");
  if (!cleanText(property?.neighborhood)) issues.push("bairro obrigatório");
  if (!stateForProperty(property)) {
    issues.push("estado não identificável: informe a UF explicitamente no endereço ou cidade");
  }

  const description = descriptionText(property);
  if (Array.from(description).length < MIN_DESCRIPTION_LENGTH) {
    issues.push("descrição VRSync deve ter pelo menos 50 caracteres");
  } else if (Array.from(description).length > MAX_DESCRIPTION_LENGTH) {
    issues.push("descrição excede 3000 caracteres");
  }

  if (type?.isLand) {
    const lotArea = integerValue(property?.total_area);
    if (!hasValue(property?.total_area) || lotArea === null || lotArea <= 0) {
      issues.push("área do terreno obrigatória ou inválida");
    }
  } else if (type) {
    const livingArea = integerValue(property?.living_area);
    if (!hasValue(property?.living_area) || livingArea === null || livingArea <= 0) {
      issues.push("área útil (LivingArea) obrigatória; área total ou construída não foi presumida como equivalente");
    }
  }

  if (type?.requiresBedrooms && !validCount(property?.bedrooms)) {
    issues.push("quantidade de dormitórios obrigatória ou inválida");
  }
  for (const [field, label] of [["bathrooms", "banheiros"], ["parking", "vagas"]]) {
    if (hasValue(property?.[field]) && !validCount(property[field])) {
      issues.push(`quantidade de ${label} inválida`);
    }
  }
  if (hasValue(property?.condominium)
    && (integerValue(property.condominium) === null || !Number.isFinite(Number(property.condominium)))) {
    issues.push("condomínio inválido");
  }

  const images = preparedImages(property);
  if (images.length < MIN_IMAGE_COUNT) {
    issues.push(`mínimo de ${MIN_IMAGE_COUNT} fotos JPG prontas; disponíveis: ${images.length}`);
  }
  if (images.some((image) => !UUID_PATTERN.test(String(image.id || "")))) {
    issues.push("identificador de fotografia inválido");
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
  return String(value ?? "").replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "");
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

function element(name, value, attributes = "") {
  return `<${name}${attributes}>${escapeXml(value)}</${name}>`;
}

function imageUrl(baseUrl, propertyId, imageId) {
  const url = new URL("/api/olx-image", baseUrl);
  url.searchParams.set("propertyId", propertyId);
  url.searchParams.set("imageId", imageId);
  return url.href;
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

function listingXml(property, baseUrl) {
  const type = propertyType(property);
  const code = propertyCode(property);
  const images = preparedImages(property);
  const primaryImage = images.find((image) => image.is_primary) || images[0];
  const propertyId = String(property.id);
  const transactionType = property.purpose === "rent" ? "For Rent" : "For Sale";
  const priceTag = property.purpose === "rent" ? "RentalPrice" : "ListPrice";
  const priceAttributes = property.purpose === "rent"
    ? ' currency="BRL" period="Monthly"'
    : ' currency="BRL"';
  const price = integerValue(property.price);
  const cep = String(property.cep).replace(/\D/g, "");
  const postalCode = `${cep.slice(0, 5)}-${cep.slice(5)}`;
  const state = stateForProperty(property);
  const description = descriptionText(property);
  const lines = [
    "    <Listing>",
    `      ${element("ListingID", code)}`,
    `      ${element("Title", cleanText(property.title))}`,
    `      ${element("TransactionType", transactionType)}`,
    "      <PublicationType>STANDARD</PublicationType>",
    `      ${element("DetailViewUrl", new URL(`/imovel.html?id=${encodeURIComponent(propertyId)}`, baseUrl).href)}`,
    "      <Media>"
  ];

  const video = youtubeVideo(property.features);
  if (video) lines.push(`        ${element("Item", video, ' medium="video"')}`);
  images.forEach((image, index) => {
    const attributes = ` medium="image" caption="img${index + 1}"${image.id === primaryImage.id ? ' primary="true"' : ""}`;
    lines.push(`        ${element("Item", imageUrl(baseUrl, propertyId, image.id), attributes)}`);
  });

  lines.push(
    "      </Media>",
    "      <Details>",
    `        ${element("UsageType", type.usage)}`,
    `        ${element("PropertyType", type.type)}`,
    `        ${element("Description", description)}`,
    `        ${element(priceTag, price, priceAttributes)}`
  );

  if (type.isLand) {
    lines.push(`        ${element("LotArea", integerValue(property.total_area), ' unit="square metres"')}`);
  } else {
    lines.push(`        ${element("LivingArea", integerValue(property.living_area), ' unit="square metres"')}`);
  }
  if (hasValue(property.condominium)) {
    lines.push(`        ${element("PropertyAdministrationFee", integerValue(property.condominium), ' currency="BRL"')}`);
  }
  if (type.requiresBedrooms) lines.push(`        ${element("Bedrooms", property.bedrooms)}`);
  if (hasValue(property.bathrooms)) lines.push(`        ${element("Bathrooms", property.bathrooms)}`);
  if (hasValue(property.parking)) {
    lines.push(`        ${element("Garage", property.parking, ' type="Parking Space"')}`);
  }

  const features = new Set();
  for (const feature of Array.isArray(property.features) ? property.features : []) {
    if (typeof feature !== "string" || feature.startsWith(PROPERTY_VIDEO_MARKER)) continue;
    const name = FEATURE_NAMES.get(normalized(feature));
    if (name) features.add(name);
  }
  if (features.size) {
    lines.push("        <Features>");
    for (const feature of features) lines.push(`          ${element("Feature", feature)}`);
    lines.push("        </Features>");
  }

  lines.push(
    "      </Details>",
    '      <Location displayAddress="Neighborhood">',
    '        <Country abbreviation="BR">Brasil</Country>',
    `        ${element("State", STATE_NAMES.get(state), ` abbreviation="${state}"`)}`,
    `        ${element("City", cityName(property))}`,
    `        ${element("Neighborhood", cleanText(property.neighborhood))}`,
    `        ${element("PostalCode", postalCode)}`,
    "      </Location>",
    "      <ContactInfo>",
    "        <Name>Nei Carvalho</Name>",
    "        <Email>nei.carvalho@creci.org.br</Email>",
    `        ${element("Website", new URL("/", baseUrl).href)}`,
    "        <Telephone>+55 15 99600-8542</Telephone>",
    "      </ContactInfo>",
    "    </Listing>"
  );
  return lines.join("\n");
}

export function buildOlxXml(properties, baseUrl, publishDate = new Date()) {
  const { validProperties } = getOlxExportReport(properties);
  const publishDateValue = publishDate.toISOString().slice(0, 19);
  const listings = validProperties.map((property) => listingXml(property, baseUrl)).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<ListingDataFeed xmlns="${VR_SYNC_NAMESPACE}" xmlns:xsi="${XSI_NAMESPACE}" xsi:schemaLocation="${VR_SYNC_NAMESPACE} ${VR_SYNC_SCHEMA}">`,
    "  <Header>",
    "    <Provider>Nei Carvalho</Provider>",
    "    <Email>nei.carvalho@creci.org.br</Email>",
    "    <ContactName>Nei Carvalho</ContactName>",
    `    <PublishDate>${publishDateValue}</PublishDate>`,
    "    <Telephone>+55 15 99600-8542</Telephone>",
    "  </Header>",
    "  <Listings>",
    listings,
    "  </Listings>",
    "</ListingDataFeed>"
  ].join("\n");
}
