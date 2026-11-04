import assert from "node:assert/strict";
import test from "node:test";
import {
  PROPERTY_VIDEO_MARKER,
  extractPropertyVideo,
  parsePropertyVideoUrl,
  setPropertyVideo
} from "./video.js";

const youtubeUrl = "https://www.youtube.com/watch?v=abcdefghijk";
const reelsUrl = "https://www.instagram.com/reel/AbC_123xyz/";

test("accepts YouTube watch, Shorts, and short links as safe embeds", () => {
  for (const url of [
    youtubeUrl,
    "https://www.youtube.com/shorts/abcdefghijk",
    "https://youtu.be/abcdefghijk"
  ]) {
    assert.deepEqual(parsePropertyVideoUrl(url), {
      platform: "youtube",
      url: youtubeUrl,
      embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk"
    });
  }
});

test("accepts public Instagram Reel URL formats", () => {
  assert.deepEqual(parsePropertyVideoUrl(reelsUrl), {
    platform: "instagram",
    url: reelsUrl,
    embedUrl: reelsUrl
  });
  assert.equal(parsePropertyVideoUrl("https://instagram.com/reel/AbC_123xyz?igsh=abc").url, reelsUrl);
});

test("rejects HTML, untrusted hosts, invalid paths, and non-HTTPS URLs", () => {
  for (const value of [
    "<iframe src='https://youtube.com/embed/abcdefghijk'></iframe>",
    "https://youtube.com.evil.example/watch?v=abcdefghijk",
    "https://www.instagram.com/p/AbC_123xyz/",
    "http://www.youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/watch?v=not-a-valid-id"
  ]) {
    assert.equal(parsePropertyVideoUrl(value), null);
  }
});

test("extracts a video marker while preserving normal characteristics", () => {
  const result = extractPropertyVideo([
    "Piscina",
    "Área gourmet",
    `${PROPERTY_VIDEO_MARKER}${youtubeUrl}`
  ]);
  assert.deepEqual(result.features, ["Piscina", "Área gourmet"]);
  assert.equal(result.video.url, youtubeUrl);
});

test("leaves existing properties without video unchanged", () => {
  const features = ["Varanda", "Armários planejados"];
  assert.deepEqual(extractPropertyVideo(features), { features, video: null });
  assert.deepEqual(setPropertyVideo(features, ""), features);
});

test("stores a new YouTube video without replacing characteristics", () => {
  const stored = setPropertyVideo(["Piscina", "Área gourmet"], youtubeUrl);
  assert.deepEqual(stored, [
    "Piscina",
    "Área gourmet",
    `${PROPERTY_VIDEO_MARKER}${youtubeUrl}`
  ]);
});

test("stores an Instagram Reel in the same reserved marker format", () => {
  assert.deepEqual(setPropertyVideo(["Varanda"], reelsUrl), [
    "Varanda",
    `${PROPERTY_VIDEO_MARKER}${reelsUrl}`
  ]);
});

test("keeps the existing video when an edit saves it again without duplicates", () => {
  const original = setPropertyVideo(["Piscina"], youtubeUrl);
  const { features, video } = extractPropertyVideo(original);
  assert.deepEqual(setPropertyVideo(features, video.url), original);
});

test("replaces only the reserved video marker when changing the link", () => {
  const original = setPropertyVideo(["Piscina", "Área gourmet"], youtubeUrl);
  const replaced = setPropertyVideo(extractPropertyVideo(original).features, reelsUrl);
  assert.deepEqual(replaced, [
    "Piscina",
    "Área gourmet",
    `${PROPERTY_VIDEO_MARKER}${reelsUrl}`
  ]);
});

test("removes the video marker without removing characteristics", () => {
  const original = setPropertyVideo(["Piscina"], youtubeUrl);
  assert.deepEqual(setPropertyVideo(extractPropertyVideo(original).features, ""), ["Piscina"]);
});
