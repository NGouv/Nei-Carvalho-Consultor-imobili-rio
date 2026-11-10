const { createPublicSupabaseClient } = require("../lib/olx-supabase.cjs");
const { MAX_IMAGE_BYTES, validateOlxImage } = require("../lib/olx-image.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function waitForDrain(response) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      response.removeListener("drain", onDrain);
      response.removeListener("close", onClose);
      response.removeListener("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve(true);
    };
    const onClose = () => {
      cleanup();
      resolve(false);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    response.once("drain", onDrain);
    response.once("close", onClose);
    response.once("error", onError);
  });
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
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
      .select("storage_path,olx_storage_path,olx_ready")
      .eq("id", imageId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (imageError) throw imageError;
    if (!image || !image.olx_ready) {
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

    const imagePath = image.olx_storage_path || image.storage_path;
    const { data: file, error: downloadError } = await supabase.storage
      .from("property-photos")
      .download(imagePath);
    if (downloadError) throw downloadError;

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const validImage = await validateOlxImage(imageBuffer);
    if (!validImage || imageBuffer.length > MAX_IMAGE_BYTES) {
      response.statusCode = 502;
      response.end("A imagem não atende às especificações da OLX.");
      return;
    }

    response.setHeader("Content-Type", validImage.contentType);
    response.setHeader("Content-Length", String(imageBuffer.length));
    response.statusCode = 200;
    for (let offset = 0; offset < imageBuffer.length; offset += 64 * 1024) {
      if (!response.write(imageBuffer.subarray(offset, offset + 64 * 1024))) {
        if (!await waitForDrain(response)) return;
      }
    }
    response.end();
  } catch (error) {
    console.error("[olx-image] Não foi possível disponibilizar a imagem.", error);
    if (response.headersSent) {
      if (!response.destroyed) response.destroy(error);
      return;
    }
    response.statusCode = 500;
    response.end("Imagem temporariamente indisponível.");
  }
};
