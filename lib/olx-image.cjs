const sharp = require("sharp");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 2160;
const MAX_HEIGHT = 3840;
const OUTPUT_TARGET_BYTES = 4_900_000;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "gif"]);

function orientedDimensions(metadata) {
  const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation);
  return {
    width: swapsDimensions ? metadata.height : metadata.width,
    height: swapsDimensions ? metadata.width : metadata.height
  };
}

function isOlxReadyImage(metadata, bytes) {
  const { width, height } = orientedDimensions(metadata);
  return ACCEPTED_FORMATS.has(metadata.format)
    && width >= 50
    && height >= 50
    && width <= MAX_WIDTH
    && height <= MAX_HEIGHT
    && metadata.orientation === undefined
    && bytes.length <= MAX_IMAGE_BYTES;
}

async function prepareOlxImage(input) {
  const metadata = await sharp(input, { failOn: "error", limitInputPixels: 100_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error("O arquivo não contém uma imagem compatível.");
  }

  if (isOlxReadyImage(metadata, input)) {
    await sharp(input, { failOn: "error", limitInputPixels: 100_000_000 }).stats();
    return {
      buffer: input,
      contentType: `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}`,
      optimized: false,
      width: orientedDimensions(metadata).width,
      height: orientedDimensions(metadata).height
    };
  }

  let width = MAX_WIDTH;
  let height = MAX_HEIGHT;
  const sourceDimensions = orientedDimensions(metadata);
  if (sourceDimensions.width <= MAX_WIDTH && sourceDimensions.height <= MAX_HEIGHT) {
    width = sourceDimensions.width;
    height = sourceDimensions.height;
  }

  for (let scaleAttempt = 0; scaleAttempt < 8; scaleAttempt += 1) {
    for (const quality of [86, 80, 74, 68, 62, 56, 50, 44]) {
      const { data, info } = await sharp(input, {
        failOn: "error",
        limitInputPixels: 100_000_000
      })
        .rotate()
        .resize({ width, height, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        .toBuffer({ resolveWithObject: true });

      if (data.length <= OUTPUT_TARGET_BYTES
        && info.width >= 50
        && info.height >= 50
        && info.width <= MAX_WIDTH
        && info.height <= MAX_HEIGHT) {
        return {
          buffer: data,
          contentType: "image/jpeg",
          optimized: true,
          width: info.width,
          height: info.height
        };
      }
    }

    width = Math.max(50, Math.floor(width * 0.8));
    height = Math.max(50, Math.floor(height * 0.8));
  }

  throw new Error("Não foi possível gerar uma versão OLX dentro do limite de 5 MB.");
}

async function validateOlxImage(input) {
  if (!Buffer.isBuffer(input) || input.length > MAX_IMAGE_BYTES) return null;
  try {
    const metadata = await sharp(input, { failOn: "error", limitInputPixels: 100_000_000 }).metadata();
    if (!metadata.width || !metadata.height || !ACCEPTED_FORMATS.has(metadata.format)) return null;
    const dimensions = orientedDimensions(metadata);
    if (dimensions.width < 50 || dimensions.height < 50
      || dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) return null;
    await sharp(input, { failOn: "error", limitInputPixels: 100_000_000 }).stats();
    return {
      contentType: `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}`,
      width: dimensions.width,
      height: dimensions.height
    };
  } catch {
    return null;
  }
}

module.exports = { MAX_IMAGE_BYTES, prepareOlxImage, validateOlxImage };
