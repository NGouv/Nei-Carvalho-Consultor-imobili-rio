import assert from "node:assert/strict";
import test from "node:test";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { buildOlxXml, getOlxExportReport, getOlxPropertyIssues } from "./olx-xml.mjs";

const VR_SYNC_NAMESPACE = "http://www.vivareal.com/schemas/1.0/VRSync";
const completeProperty = {
  id: "12345678-1234-1234-1234-123456789abc",
  title: "Apartamento confortável no Centro",
  property_type: "Apartamento",
  purpose: "sale",
  price: 520000.5,
  condominium: 650.9,
  cep: "18035-000",
  city: "Sorocaba",
  neighborhood: "Centro",
  address: "Rua Exemplo, 100 - SP",
  bedrooms: 6,
  bathrooms: 2,
  parking: 1,
  total_area: 90,
  living_area: 82.4,
  description: "Apartamento bem localizado, com ambientes amplos e acesso facilitado a comércio e serviços.",
  features: ["Piscina", "Varanda", "Armários embutidos"],
  property_images: Array.from({ length: 5 }, (_, index) => ({
    id: `${String(index + 1).padStart(8, "0")}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
    display_order: index,
    is_primary: index === 0,
    olx_ready: true
  }))
};

function parseXml(xml) {
  return new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false
  }).parse(xml);
}

function text(value) {
  return typeof value === "object" ? value["#text"] : value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function validLand(overrides = {}) {
  return {
    ...completeProperty,
    property_type: "Terreno",
    total_area: 450,
    living_area: undefined,
    bedrooms: null,
    ...overrides
  };
}

test("generates a VRSync ListingDataFeed with the official namespaces and header", () => {
  const xml = buildOlxXml([completeProperty], "https://imoveis.example", new Date("2026-01-02T03:04:05.000Z"));
  assert.equal(XMLValidator.validate(xml), true);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<ListingDataFeed xmlns="http:\/\/www\.vivareal\.com\/schemas\/1\.0\/VRSync"/);
  assert.match(xml, /xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"/);
  assert.match(xml, /xsi:schemaLocation="http:\/\/www\.vivareal\.com\/schemas\/1\.0\/VRSync http:\/\/xml\.vivareal\.com\/vrsync\.xsd"/);
  assert.doesNotMatch(xml, /<Carga\b|<Imovel>/);
  assert.match(xml, /<Provider>Nei Carvalho<\/Provider>/);
  assert.match(xml, /<Email>nei\.carvalho@creci\.org\.br<\/Email>/);
  assert.match(xml, /<ContactName>Nei Carvalho<\/ContactName>/);
  assert.match(xml, /<PublishDate>2026-01-02T03:04:05<\/PublishDate>/);
  assert.match(xml, /<Telephone>\+55 15 99600-8542<\/Telephone>/);
});

test("maps apartment data to the VRSync listing structure and documented values", () => {
  const xml = buildOlxXml([completeProperty], "https://imoveis.example");
  const document = parseXml(xml);
  const listing = document.ListingDataFeed.Listings.Listing;

  assert.equal(document.ListingDataFeed["@_xmlns"], VR_SYNC_NAMESPACE);
  assert.equal(listing.ListingID, completeProperty.id);
  assert.equal(listing.Title, completeProperty.title);
  assert.equal(listing.TransactionType, "For Sale");
  assert.equal(listing.PublicationType, "STANDARD");
  assert.match(listing.DetailViewUrl, /^https:\/\/imoveis\.example\/imovel\.html\?id=/);
  assert.equal(text(listing.Location.Country), "Brasil");
  assert.equal(listing.Location.Country["@_abbreviation"], "BR");
  assert.equal(text(listing.Location.State), "São Paulo");
  assert.equal(listing.Location.State["@_abbreviation"], "SP");
  assert.equal(listing.Location.City, "Sorocaba");
  assert.equal(listing.Location.Neighborhood, "Centro");
  assert.equal(listing.Location.PostalCode, "18035-000");
  assert.equal(listing.Details.UsageType, "Residential");
  assert.equal(listing.Details.PropertyType, "Residential / Apartment");
  assert.equal(text(listing.Details.ListPrice), "520000");
  assert.equal(listing.Details.ListPrice["@_currency"], "BRL");
  assert.equal(text(listing.Details.LivingArea), "82");
  assert.equal(listing.Details.LivingArea["@_unit"], "square metres");
  assert.equal(text(listing.Details.PropertyAdministrationFee), "650");
  assert.equal(listing.Details.Bedrooms, "6");
  assert.equal(listing.Details.Bathrooms, "2");
  assert.equal(text(listing.Details.Garage), "1");
  assert.equal(listing.Details.Garage["@_type"], "Parking Space");
  assert.deepEqual(listing.Details.Features.Feature, ["Pool", "Balcony", "Builtin Wardrobe"]);
  assert.equal(listing.ContactInfo.Name, "Nei Carvalho");
  assert.equal(listing.ContactInfo.Email, "nei.carvalho@creci.org.br");
  assert.equal(listing.ContactInfo.Telephone, "+55 15 99600-8542");
  assert.ok(xml.indexOf("<Media>") < xml.indexOf("<Details>"));
  assert.ok(xml.indexOf("<Details>") < xml.indexOf("<Location"));
  assert.ok(xml.indexOf("<Location") < xml.indexOf("<ContactInfo>"));
  assert.equal(listing.Media.Item.length, 5);
  assert.equal(listing.Media.Item[0]["@_primary"], "true");
  assert.ok(listing.Media.Item.every((item) => item["@_medium"] === "image"));
  assert.ok(listing.Media.Item.every((item) => /^https:\/\/imoveis\.example\/api\/olx-image\?/.test(item["#text"])));
});

test("uses listing-specific transaction and price values for rental and land", () => {
  const xml = buildOlxXml([validLand({ purpose: "rent" })], "https://imoveis.example");
  const listing = parseXml(xml).ListingDataFeed.Listings.Listing;
  assert.equal(listing.TransactionType, "For Rent");
  assert.equal(text(listing.Details.RentalPrice), "520000");
  assert.equal(listing.Details.RentalPrice["@_currency"], "BRL");
  assert.equal(listing.Details.RentalPrice["@_period"], "Monthly");
  assert.equal(listing.Details.UsageType, "Residential");
  assert.equal(listing.Details.PropertyType, "Residential / Land");
  assert.equal(text(listing.Details.LotArea), "450");
  assert.equal(listing.Details.LotArea["@_unit"], "square metres");
  assert.equal(listing.Details.ListPrice, undefined);
  assert.equal(listing.Details.LivingArea, undefined);
});

test("emits a valid YouTube video and mapped features without accepting other video hosts", () => {
  const xml = buildOlxXml([{
    ...completeProperty,
    features: [
      "Piscina",
      "Área gourmet",
      "__NEI_CARVALHO_PROPERTY_VIDEO__:https://www.youtube.com/watch?v=abcdefghijk",
      "__NEI_CARVALHO_PROPERTY_VIDEO__:https://www.instagram.com/reel/AbC_123xyz/"
    ]
  }], "https://imoveis.example");
  const listing = parseXml(xml).ListingDataFeed.Listings.Listing;
  assert.equal(listing.Media.Item.length, 6);
  assert.equal(listing.Media.Item[0]["@_medium"], "video");
  assert.equal(listing.Media.Item[0]["#text"], "https://www.youtube.com/watch?v=abcdefghijk");
  assert.deepEqual(asArray(listing.Details.Features.Feature), ["Pool"]);
  assert.match(listing.Details.Description, /Características: Área gourmet/);
  assert.doesNotMatch(xml, /instagram\.com/);
});

test("rejects state inference unless a Brazilian UF is explicit in the address, city, or stored state", () => {
  const missingState = { ...validLand(), address: "Rua Exemplo, 100", city: "Sorocaba" };
  assert.ok(getOlxPropertyIssues(missingState).some((issue) => issue.includes("estado não identificável")));
  const validFromCity = { ...missingState, city: "Sorocaba - SP" };
  assert.ok(!getOlxPropertyIssues(validFromCity).some((issue) => issue.includes("estado não identificável")));

  const explicitState = { ...completeProperty, address: "Rua Exemplo, 100", city: "Sorocaba", state: "SP" };
  assert.ok(!getOlxPropertyIssues(explicitState).some((issue) => issue.includes("estado não identificável")));
  assert.ok(!getOlxPropertyIssues(explicitState).some((issue) => issue.includes("LivingArea")));

  const xml = buildOlxXml([explicitState], "https://imoveis.example");
  const document = parseXml(xml);
  const listing = document.ListingDataFeed.Listings.Listing;
  const location = listing.Location;
  assert.equal(location.City, "Sorocaba");
  assert.equal(location.State["@_abbreviation"], "SP");
  assert.equal(text(listing.Details.LivingArea), "82");
});

test("rejects listings missing VRSync-required title, description, location, price, or area", () => {
  const rejected = [
    { ...completeProperty, title: "" },
    { ...completeProperty, title: "x".repeat(91) },
    { ...completeProperty, title: "Título <b>HTML</b>" },
    { ...completeProperty, description: "Descrição curta" },
    { ...completeProperty, description: "x".repeat(3001) },
    { ...completeProperty, city: "" },
    { ...completeProperty, neighborhood: "" },
    { ...completeProperty, price: null },
    { ...completeProperty, living_area: null }
  ];
  const issues = rejected.map(getOlxPropertyIssues);
  assert.ok(issues[0].some((issue) => issue.includes("título")));
  assert.ok(issues[1].some((issue) => issue.includes("título excede")));
  assert.ok(issues[2].some((issue) => issue.includes("tags HTML")));
  assert.ok(issues[3].some((issue) => issue.includes("pelo menos 50")));
  assert.ok(issues[4].some((issue) => issue.includes("excede 3000")));
  assert.ok(issues[5].includes("cidade obrigatória"));
  assert.ok(issues[6].includes("bairro obrigatório"));
  assert.ok(issues[7].includes("preço obrigatório ou inválido"));
  assert.ok(issues[8].some((issue) => issue.includes("área útil")));
  assert.equal(parseXml(buildOlxXml(rejected, "https://imoveis.example"))
    .ListingDataFeed.Listings.Listing, undefined);
});

test("does not mistake the existing total or built area for the VRSync usable area", () => {
  const withoutLivingArea = {
    ...completeProperty,
    living_area: undefined,
    built_area: 80
  };
  assert.ok(getOlxPropertyIssues(withoutLivingArea)
    .some((issue) => issue.includes("área total ou construída não foi presumida")));
});

test("rejects unsupported property subtypes rather than inventing a VRSync category", () => {
  assert.ok(getOlxPropertyIssues({ ...validLand(), property_type: "Comercial" })
    .includes("tipo de imóvel sem mapeamento VRSync"));
  assert.ok(getOlxPropertyIssues({ ...validLand(), property_type: "Outro" })
    .includes("tipo de imóvel sem mapeamento VRSync"));
});

test("rejects invalid CEP, purpose, price, room counts, and malformed ready photo IDs", () => {
  const property = {
    ...completeProperty,
    cep: null,
    purpose: "seasonal",
    price: "not-a-price",
    bedrooms: -1,
    property_images: [
      ...completeProperty.property_images.slice(0, 4),
      { id: "bad-photo-id", is_primary: false, olx_ready: true }
    ]
  };
  const issues = getOlxPropertyIssues(property);
  assert.ok(issues.includes("CEP obrigatório"));
  assert.ok(issues.includes("finalidade do imóvel inválida"));
  assert.ok(issues.includes("preço obrigatório ou inválido"));
  assert.ok(issues.includes("quantidade de dormitórios obrigatória ou inválida"));
  assert.ok(issues.includes("identificador de fotografia inválido"));
});

test("rejects every listing with fewer than five prepared images and keeps pending images available for preparation", () => {
  const property = {
    ...completeProperty,
    property_images: [
      { ...completeProperty.property_images[0], olx_ready: true },
      ...completeProperty.property_images.slice(1).map((image) => ({ ...image, olx_ready: false }))
    ]
  };
  assert.ok(getOlxPropertyIssues(property).includes("mínimo de 5 fotos JPG prontas; disponíveis: 1"));
  assert.equal((buildOlxXml([property], "https://imoveis.example").match(/medium="image"/g) || []).length, 0);
});

test("rejects duplicate ListingIDs and reports each affected property", () => {
  const collidingIds = [
    "12345678-1234-1234-1234-123456789abc",
    "12345678-1234-1234-1234-123456789abc",
    "12345678-1234-1234-1234-123456789abc"
  ];
  const report = getOlxExportReport(collidingIds.map((id) => ({ ...completeProperty, id })));
  assert.deepEqual(report.validProperties, []);
  assert.equal(report.rejectedProperties.length, 3);
  assert.ok(report.rejectedProperties.every(({ issues }) => issues.includes("código do imóvel duplicado")));
  assert.equal(parseXml(buildOlxXml(report.validProperties, "https://imoveis.example"))
    .ListingDataFeed.Listings.Listing, undefined);
});

test("exports every eligible listing with all prepared photos and counts invalid records", () => {
  const properties = Array.from({ length: 8 }, (_, index) => ({
    ...validLand(),
    id: `${String(index + 1).padStart(8, "0")}-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    property_images: Array.from({ length: 5 }, (unused, imageIndex) => ({
      id: `${String(index + 1).padStart(8, "0")}-${String(imageIndex + 1).padStart(4, "0")}-aaaa-aaaa-aaaaaaaaaaaa`,
      display_order: imageIndex,
      is_primary: imageIndex === 0,
      olx_ready: true
    }))
  }));
  const report = getOlxExportReport([...properties, { ...validLand(), cep: null }]);
  const xml = buildOlxXml(report.validProperties, "https://imoveis.example");
  const listing = parseXml(xml).ListingDataFeed.Listings.Listing;

  assert.equal(report.validProperties.length, 8);
  assert.equal(report.rejectedProperties.length, 1);
  assert.equal(listing.length, 8);
  assert.equal(new Set(listing.map((item) => item.ListingID)).size, 8);
  assert.equal(listing.reduce((count, item) => count + item.Media.Item.length, 0), 40);
});

test("preserves validated title and description text in XML", () => {
  const property = {
    ...completeProperty,
    title: "Imóvel & confortável no Centro",
    description: "Descrição com & válido > caractere e uma linha\nsegunda linha sem marcação HTML."
  };
  const xml = buildOlxXml([property], "https://imoveis.example");
  const listing = parseXml(xml).ListingDataFeed.Listings.Listing;
  assert.equal(listing.Title, property.title);
  assert.equal(listing.Details.Description, property.description);
});
