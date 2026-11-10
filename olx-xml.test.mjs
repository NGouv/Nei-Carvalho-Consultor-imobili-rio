import assert from "node:assert/strict";
import test from "node:test";
import { buildOlxXml, getOlxPropertyIssues } from "./olx-xml.mjs";

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
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", display_order: 1, is_primary: false },
    { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", display_order: 0, is_primary: true }
  ]
};

test("generates an OLX Carga document with documented apartment fields", () => {
  const xml = buildOlxXml([completeProperty], "https://imoveis.example");
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
  }
});

test("omits published records missing OLX-required data or a documented subtype", () => {
  const incompleteProperties = [
    { ...completeProperty, cep: null },
    { ...completeProperty, description: "  " },
    { ...completeProperty, property_type: "Outro" }
  ];
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[0]), ["CEP obrigatório"]);
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[1]), ["descrição obrigatória"]);
  assert.deepEqual(getOlxPropertyIssues(incompleteProperties[2]), ["tipo de imóvel sem mapeamento OLX"]);
  assert.match(buildOlxXml(incompleteProperties, "https://imoveis.example"), /<Imoveis>\s*<\/Imoveis>/);
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
