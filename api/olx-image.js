const { createPublicSupabaseClient } = require("../lib/olx-supabase.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.end("Método não permitido.");
    return;
  }

  const propertyId = request.query?.propertyId;
  const imageId = request.query?.imageId;
  if (typeof propertyId !== "string" || typeof imageId !== "string"
    || !UUID_PATTERN.test(propertyId) || !UUID_PATTERN.test(imageId)) {
    response.statusCode = 400;
    response.end("Identificador de imagem inválido.");
    return;
  }

  try {
    const supabase = createPublicSupabaseClient();
    const { data: image, error: imageError } = await supabase
      .from("property_images")
      .select("storage_path")
      .eq("id", imageId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (imageError) throw imageError;
    if (!image) {
      response.statusCode = 404;
      response.end("Imagem não encontrada.");
      return;
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("status", "published")
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) {
      response.statusCode = 404;
      response.end("Imagem não encontrada.");
      return;
    }

    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from("property-photos")
      .createSignedUrl(image.storage_path, 86400);
    if (signedUrlError) throw signedUrlError;
    response.statusCode = 302;
    response.setHeader("Location", signedUrl.signedUrl);
    response.end();
  } catch (error) {
    console.error("[olx-image] Não foi possível disponibilizar a imagem.", error);
    response.statusCode = 500;
    response.end("Imagem temporariamente indisponível.");
  }
};
