import assert from "node:assert/strict";
import test from "node:test";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { buildOlxXml, getOlxExportReport, getOlxPropertyIssues } from "./olx-xml.mjs";

const completeProperty = {
  id: "12345678-1234-1234-1234-123456789abc",
  title: "Apartamento & confortável <novo>",
  property_type: "Apartamento",
  purpose: "sale",
  price: 520000.5,
  condominium: 650,
  cep: "18035-000",
  city: "Sorocaba",
  neighborhood: "Centro",
  bedrooms: 6,
  bathrooms: 2,
  parking: 1,
  total_area: 82.4,
  description: "Descrição do imóvel",
  features: ["Piscina", "Varanda", "Armários embutidos"],
  property_images: [
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", display_order: 1, is_primary: false, olx_ready: true },
    { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", display_order: 0, is_primary: true, olx_ready: true }
  ]
};

test("generates an OLX Carga document with documented apartment fields", () => {
  const xml = buildOlxXml([completeProperty], "https://imoveis.example");
  assert.equal(XMLValidator.validate(xml), true);
  assert.match(xml, /^<\?xml version="1\.0" encoding="utf-8"\?>/);
  assert.match(xml, /<Carga xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"/);
  assert.match(xml, /<CodigoImovel>12345678123412341234<\/CodigoImovel>/);
  assert.match(xml, /<SubTipoImovel>Apartamento<\/SubTipoImovel>/);
  assert.match(xml, /<CEP>18035000<\/CEP>/);
  assert.match(xml, /<PrecoVenda>520001<\/PrecoVenda>/);
  assert.match(xml, /<QtdDormitorios>5<\/QtdDormitorios>/);
  assert.match(xml, /<QtdBanheiros>2<\/QtdBanheiros>/);
  assert.match(xml, /<AreaTotal>82<\/AreaTotal>/);
  assert.match(xml, /<Piscina>1<\/Piscina>/);
  assert.match(xml, /<Varanda>1<\/Varanda>/);
  assert.match(xml, /<ArmarioEmbutido>1<\/ArmarioEmbutido>/);
  assert.match(xml, /Apartamento &amp; confortável &lt;novo&gt;/);
  assert.match(xml, /<Principal>1<\/Principal>/);
  assert.ok(xml.indexOf("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    < xml.indexOf("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
  assert.match(xml, /https:\/\/imoveis\.example\/api\/olx-image\?propertyId=/);
});

test("parses the complete OLX structure and required fields with an independent XML parser", () => {
  const xml = buildOlxXml([{
    ...completeProperty,
    description: "Texto & válido > ainda válido\nsegunda linha"
  }], "https://imoveis.example");
  const document = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false
  }).parse(xml);
  const property = document.Carga.Imoveis.Imovel;

  assert.equal(typeof property.CodigoImovel, "string");
  assert.equal(property.SubTipoImovel, "Apartamento");
  assert.equal(property.CEP, "18035000");
  assert.equal(property.QtdDormitorios, "5");
  assert.equal(property.Observacao, "Texto & válido > ainda válido\\nsegunda linha\\nCaracterísticas: Piscina, Varanda, Armários embutidos");
  assert.equal(property.Fotos.Foto[0].Principal, "1");
  assert.match(property.Fotos.Foto[0].URLArquivo, /^https:\/\/imoveis\.example\/api\/olx-image\?/);
});

test("allows absent optional title, city, neighborhood, and price fields", () => {
  for (const price of [null, undefined, ""]) {
    const property = {
      ...completeProperty,
      title: "",
      city: "",
      neighborhood: "",
      price
    };
    assert.deepEqual(getOlxPropertyIssues(property), []);

    const xml = buildOlxXml([property], "https://imoveis.example");
    assert.match(xml, /<CodigoImovel>12345678123412341234<\/CodigoImovel>/);
    assert.match(xml, /<SubTipoImovel>Apartamento<\/SubTipoImovel>/);
    assert.match(xml, /<CEP>18035000<\/CEP>/);
    assert.match(xml, /<Observacao>Descrição do imóvel/);
    assert.doesNotMatch(xml, /<TituloAnuncio>|<Cidade>|<Bairro>|<PrecoVenda>|<PrecoLocacao>/);
  }
});

test("maps rental prices and the property types accepted by the OLX guide", () => {
  for (const [propertyType, subtype] of [
    ["Casa", "Casa"],
    ["Terreno", "Terreno"],
    ["Comercial", "Comercial"]
  ]) {
    const xml = buildOlxXml([{
      ...completeProperty,
      property_type: propertyType,
      purpose: "rent",
      property_images: []
    }], "https://imoveis.example");
    assert.match(xml, new RegExp(`<SubTipoImovel>${subtype}<\\/SubTipoImovel>`));
    assert.match(xml, /<PrecoLocacao>520001<\/PrecoLocacao>/);
    assert.doesNotMatch(xml, /<PrecoVenda>/);
    if (propertyType === "Comercial" || propertyType === "Terreno") {
      assert.doesNotMatch(xml, /<QtdDormitorios>/);
    }
    if (propertyType === "Terreno") assert.doesNotMatch(xml, /<QtdBanheiros>|<QtdVagas>/);
    if (propertyType === "Comercial") assert.doesNotMatch(xml, /<QtdBanheiros>/);
  }
});

test("omits published records missing OLX-required data or a documented subtype", () => {
  const incompleteProperties = [
    { ...completeProperty, id: null },
    { ...completeProperty, cep: null },
    { ...completeProperty, description: "  " },
    { ...completeProperty, property_type: "Outro" }
  ];
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[0]), ["código do imóvel obrigatório"]);
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[1]), ["CEP obrigatório"]);
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[2]), ["descrição obrigatória"]);
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[3]), ["tipo de imóvel sem mapeamento OLX"]);
  assert.match(buildOlxXml(incompleteProperties, "https://imoveis.example"), /<Imoveis>\s*<\/Imoveis>/);
});

test("rejects duplicated codes and identifies every conflicting property", () => {
  const collidingIds = [
    "12345678-1234-1234-1234-123456789abc",
    "12345678-1234-1234-1234-ffffffffffff",
    "12345678-1234-1234-1234-000000000000"
  ];
  const report = getOlxExportReport(collidingIds.map((id) => ({ ...completeProperty, id })));

  assert.deepEqual(report.validProperties, []);
  assert.equal(report.rejectedProperties.length, 3);
  assert.ok(report.rejectedProperties.every(({ issues }) => issues.includes("código do imóvel duplicado")));
  assert.doesNotMatch(buildOlxXml(collidingIds.map((id) => ({ ...completeProperty, id })), "https://imoveis.example"), /<Imovel>/);
});

test("rejects invalid purposes, bedrooms, and titles without treating an absent price as invalid", () => {
  const invalidProperty = {
    ...completeProperty,
    purpose: "seasonal",
    price: null,
    bedrooms: null,
    title: "x".repeat(91)
  };
  const issues = getOlxPropertyIssues(invalidProperty);

  assert.ok(issues.includes("finalidade do imóvel inválida"));
  assert.ok(!issues.some((issue) => issue.includes("preço")));
  assert.ok(issues.includes("quantidade de dormitórios obrigatória ou inválida"));
  assert.ok(issues.includes("título excede 90 caracteres"));
  assert.doesNotMatch(buildOlxXml([invalidProperty], "https://imoveis.example"), /<PrecoVenda>|<PrecoLocacao>/);
});

test("rejects a malformed price only when a price value was provided", () => {
  const issues = getOlxPropertyIssues({ ...completeProperty, price: "not-a-price" });
  assert.ok(issues.includes("preço inválido"));
});

test("rejects oversized descriptions and omits optional counts when data is absent", () => {
  const oversized = { ...completeProperty, description: "x".repeat(6001) };
  assert.ok(getOlxPropertyIssues(oversized).includes("descrição excede 6000 caracteres"));
  const lineBreakExpansion = {
    ...completeProperty,
    description: `${"x".repeat(3001)}\n${"x".repeat(2998)}`
  };
  assert.ok(getOlxPropertyIssues(lineBreakExpansion).includes("observação excede 6000 caracteres"));

  const xml = buildOlxXml([{
    ...completeProperty,
    condominium: null,
    total_area: null,
    bathrooms: null,
    parking: null
  }], "https://imoveis.example");
  assert.doesNotMatch(xml, /<PrecoCondominio>|<AreaTotal>|<QtdBanheiros>|<QtdVagas>/);
});

test("keeps all eight valid listings and their prepared photos in the OLX feed", () => {
  const properties = Array.from({ length: 8 }, (_, index) => ({
    ...completeProperty,
    id: `0000000${index + 1}-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    property_images: [{
      id: `${String(index + 1).padStart(8, "0")}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      display_order: 0,
      is_primary: true,
      olx_ready: true
    }]
  }));
  const xml = buildOlxXml(properties, "https://imoveis.example");

  assert.equal((xml.match(/<Imovel>/g) || []).length, 8);
  assert.equal((xml.match(/<CodigoImovel>/g) || []).length, 8);
  assert.equal((xml.match(/<URLArquivo>/g) || []).length, 8);
});

test("exports only a YouTube video and keeps arbitrary features in the observation", () => {
  const xml = buildOlxXml([{
    ...completeProperty,
    features: [
      "Piscina",
      "Área gourmet",
      "__NEI_CARVALHO_PROPERTY_VIDEO__:https://www.youtube.com/watch?v=abcdefghijk",
      "__NEI_CARVALHO_PROPERTY_VIDEO__:https://www.instagram.com/reel/AbC_123xyz/"
    ],
    property_images: []
  }], "https://imoveis.example");
  assert.match(xml, /Características: Piscina, Área gourmet/);
  assert.match(xml, /<Videos><Video>https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk<\/Video><\/Videos>/);
  assert.doesNotMatch(xml, /instagram\.com/);
});

test("omits OLX photos that have not been prepared", () => {
  const xml = buildOlxXml([{
    ...completeProperty,
    property_images: [
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", display_order: 0, is_primary: true, olx_ready: false },
      { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", display_order: 1, is_primary: false, olx_ready: true }
    ]
  }], "https://imoveis.example");

  assert.equal((xml.match(/<URLArquivo>/g) || []).length, 1);
  assert.match(xml, /bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/);
  assert.doesNotMatch(xml, /aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/);
});
