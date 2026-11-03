import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export async function signImageUrls(images = []) {
  if (!supabase) throw new Error("Supabase não está configurado.");

  return Promise.all(images.map(async (image) => {
    const { data, error } = await supabase.storage
      .from("property-photos")
      .createSignedUrl(image.storage_path, 86400);
    if (error) throw error;
    return {
      id: image.id,
      storage_path: image.storage_path,
      src: data.signedUrl,
      alt: image.alt_text || "",
      alt_text: image.alt_text || "",
      display_order: image.display_order ?? 0,
      is_primary: Boolean(image.is_primary)
    };
  }));
}

export async function fetchPublishedProperties() {
  if (!supabase) throw new Error("Supabase não está configurado.");

  const { data, error } = await supabase
    .from("properties")
    .select("*, property_images(*)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("display_order", { referencedTable: "property_images", ascending: true });
  if (error) throw error;

  return Promise.all(data.map(async (property) => {
    const images = await signImageUrls(property.property_images || []);
    return {
      ...property,
      images: images.sort((left, right) => Number(right.is_primary) - Number(left.is_primary)
        || left.display_order - right.display_order)
    };
  }));
}

export async function fetchPublishedProperty(id) {
  if (!supabase) throw new Error("Supabase não está configurado.");

  const { data, error } = await supabase
    .from("properties")
    .select("*, property_images(*)")
    .eq("id", id)
    .eq("status", "published")
    .order("display_order", { referencedTable: "property_images", ascending: true })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const images = await signImageUrls(data.property_images || []);
  return {
    ...data,
    images: images.sort((left, right) => Number(right.is_primary) - Number(left.is_primary)
      || left.display_order - right.display_order)
  };
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
