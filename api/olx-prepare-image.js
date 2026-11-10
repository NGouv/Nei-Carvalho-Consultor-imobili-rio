const { createClient } = require("@supabase/supabase-js");
const { prepareOlxImage } = require("../lib/olx-image.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createAuthenticatedClient(accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("As variáveis públicas do Supabase não estão configuradas.");

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.statusCode = 405;
    response.end(JSON.stringify({ error: "Método não permitido." }));
    return;
  }

  const authorization = request.headers.authorization;
  const accessToken = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const { propertyId, imageId } = request.body || {};
  if (!accessToken || typeof propertyId !== "string" || typeof imageId !== "string"
    || !UUID_PATTERN.test(propertyId) || !UUID_PATTERN.test(imageId)) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "Dados de preparação inválidos." }));
    return;
  }

  let supabase;
  let uploadedDerivedPath;
  let previousOlxPath;
  try {
    supabase = createAuthenticatedClient(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) {
      response.statusCode = 401;
      response.end(JSON.stringify({ error: "Sessão administrativa inválida ou expirada." }));
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) {
      response.statusCode = 403;
      response.end(JSON.stringify({ error: "Acesso administrativo necessário." }));
      return;
    }

    const { data: image, error: imageError } = await supabase
      .from("property_images")
      .select("id,property_id,storage_path,olx_storage_path,olx_ready")
      .eq("id", imageId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (imageError) throw imageError;
    if (!image) {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "Imagem não encontrada." }));
      return;
    }
    if (image.olx_ready) {
      response.statusCode = 200;
      response.end(JSON.stringify({ ready: true, optimized: Boolean(image.olx_storage_path) }));
      return;
    }
    previousOlxPath = image.olx_storage_path;

    const { data: original, error: downloadError } = await supabase.storage
      .from("property-photos")
      .download(image.storage_path);
    if (downloadError) throw downloadError;
    const prepared = await prepareOlxImage(Buffer.from(await original.arrayBuffer()));
    const derivedPath = `${propertyId}/olx/${imageId}.jpg`;
    const olxStoragePath = prepared.optimized ? derivedPath : null;

    if (olxStoragePath) {
      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(olxStoragePath, prepared.buffer, {
          contentType: prepared.contentType,
          cacheControl: "31536000",
          upsert: true
        });
      if (uploadError) throw uploadError;
      uploadedDerivedPath = olxStoragePath;
    }

    const { error: updateError } = await supabase
      .from("property_images")
      .update({ olx_storage_path: olxStoragePath, olx_ready: true })
      .eq("id", imageId)
      .eq("property_id", propertyId);
    if (updateError) throw updateError;
    uploadedDerivedPath = null;
    if (previousOlxPath && previousOlxPath !== olxStoragePath) {
      const { error: cleanupError } = await supabase.storage
        .from("property-photos")
        .remove([previousOlxPath]);
      if (cleanupError) {
        console.error("[olx-prepare-image] Não foi possível remover uma versão OLX antiga.", cleanupError);
      }
    }

    response.statusCode = 200;
    response.end(JSON.stringify({
      ready: true,
      optimized: prepared.optimized,
      width: prepared.width,
      height: prepared.height,
      bytes: prepared.buffer.length
    }));
  } catch (error) {
    console.error("[olx-prepare-image] Não foi possível preparar a imagem.", error);
    if (uploadedDerivedPath && supabase) {
      const { error: cleanupError } = await supabase.storage
        .from("property-photos")
        .remove([uploadedDerivedPath]);
      if (cleanupError) {
        console.error("[olx-prepare-image] Não foi possível limpar a versão OLX incompleta.", cleanupError);
      }
    }
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Não foi possível preparar a imagem para a OLX." }));
  }
};
