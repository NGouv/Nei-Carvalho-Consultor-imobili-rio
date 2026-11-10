const { createPublicSupabaseClient } = require("../lib/olx-supabase.cjs");

const PAGE_SIZE = 500;
const PROPERTY_FIELDS = [
  "id",
  "title",
  "property_type",
  "purpose",
  "price",
  "condominium",
  "cep",
  "city",
  "neighborhood",
  "bedrooms",
  "bathrooms",
  "parking",
  "total_area",
  "description",
  "features",
  "property_images(id,display_order,is_primary)"
].join(",");

async function fetchPublishedProperties(supabase) {
  const properties = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("properties")
      .select(PROPERTY_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .order("display_order", { referencedTable: "property_images", ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    properties.push(...data);
    if (data.length < PAGE_SIZE) return properties;
  }
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.end("Método não permitido.");
    return;
  }

  try {
    const publicSiteUrl = process.env.PUBLIC_SITE_URL;
    if (!publicSiteUrl) throw new Error("PUBLIC_SITE_URL não está configurada.");
    const parsedSiteUrl = new URL(publicSiteUrl);
    if (parsedSiteUrl.protocol !== "https:") throw new Error("PUBLIC_SITE_URL deve usar HTTPS.");

    const supabase = createPublicSupabaseClient();
    const properties = await fetchPublishedProperties(supabase);
    const { buildOlxXml } = await import("../olx-xml.mjs");
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.statusCode = 200;
    response.end(buildOlxXml(properties, parsedSiteUrl.origin));
  } catch (error) {
    console.error("[olx-feed] Não foi possível gerar o feed.", error);
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.statusCode = 500;
    response.end("Feed OLX temporariamente indisponível.");
  }
};

module.exports.fetchPublishedProperties = fetchPublishedProperties;
