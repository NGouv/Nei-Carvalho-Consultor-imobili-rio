export const PROPERTY_VIDEO_MARKER = "__NEI_CARVALHO_PROPERTY_VIDEO__:";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be"
]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export function parsePropertyVideoUrl(value) {
  const input = String(value || "").trim();
  if (!input) return null;

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    let videoId = "";
    if (host === "youtu.be" || host === "www.youtu.be") {
      const match = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);
      videoId = match?.[1] || "";
    } else if (url.pathname === "/watch") {
      const ids = url.searchParams.getAll("v");
      videoId = ids.length === 1 ? ids[0] : "";
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/);
      videoId = match?.[1] || "";
    }

    if (!YOUTUBE_ID_PATTERN.test(videoId)) return null;
    return {
      platform: "youtube",
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`
    };
  }

  if (INSTAGRAM_HOSTS.has(host)) {
    const match = url.pathname.match(/^\/reel\/([A-Za-z0-9_-]+)\/?$/);
    if (!match || !INSTAGRAM_CODE_PATTERN.test(match[1])) return null;
    const reelUrl = `https://www.instagram.com/reel/${match[1]}/`;
    return { platform: "instagram", url: reelUrl, embedUrl: reelUrl };
  }

  return null;
}

export function extractPropertyVideo(features) {
  const normalFeatures = [];
  let video = null;

  for (const feature of Array.isArray(features) ? features : []) {
    if (typeof feature !== "string" || !feature.startsWith(PROPERTY_VIDEO_MARKER)) {
      normalFeatures.push(feature);
      continue;
    }

    const parsed = parsePropertyVideoUrl(feature.slice(PROPERTY_VIDEO_MARKER.length));
    if (!video && parsed) video = parsed;
  }

  return { features: normalFeatures, video };
}

export function setPropertyVideo(features, value) {
  const normalFeatures = extractPropertyVideo(features).features;
  const videoUrl = String(value || "").trim();
  if (!videoUrl) return normalFeatures;

  const video = parsePropertyVideoUrl(videoUrl);
  if (!video) throw new Error("Informe um link válido do YouTube ou de um Instagram Reels público.");
  return [...normalFeatures, `${PROPERTY_VIDEO_MARKER}${video.url}`];
}
