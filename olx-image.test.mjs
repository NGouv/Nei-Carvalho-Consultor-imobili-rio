import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { MAX_IMAGE_BYTES, prepareOlxImage, validateOlxImage } = require("./lib/olx-image.cjs");

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    }
  };
}

async function invokePreparationFailure(failureStage, imageBuffer) {
  const imageId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const propertyId = "12345678-1234-1234-1234-123456789abc";
  const originalEnvironment = { ...process.env };
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_ANON_KEY = "public-anon-key";

  const supabasePath = require.resolve("@supabase/supabase-js");
  const Module = require("node:module");
  const originalSupabaseModule = require.cache[supabasePath];
  const loggedErrors = [];
  let updateRequested = false;
  const mockSupabaseModule = new Module(supabasePath);
  mockSupabaseModule.filename = supabasePath;
  mockSupabaseModule.loaded = true;
  mockSupabaseModule.exports = {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin-id" } }, error: null }) },
      from(table) {
        const builder = {
          select() { return builder; },
          update() { updateRequested = true; return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return {
              data: table === "admin_users"
                ? { user_id: "admin-id" }
                : {
                  id: imageId,
                  property_id: propertyId,
                  storage_path: `${propertyId}/original.jpg`,
                  olx_storage_path: null,
                  olx_ready: false
                },
              error: null
            };
          },
          then(resolve, reject) {
            const error = failureStage === "update" && updateRequested
              ? new Error("mock update failure")
              : null;
            return Promise.resolve({ error }).then(resolve, reject);
          }
        };
        return builder;
      },
      storage: {
        from() {
          return {
            async download() {
              return failureStage === "download"
                ? { data: null, error: new Error("mock download failure") }
                : { data: new Blob([imageBuffer]), error: null };
            },
            async upload() {
              return {
                error: failureStage === "upload" ? new Error("mock upload failure") : null
              };
            },
            async remove() {
              return { error: null };
            }
          };
        }
      }
    })
  };
  require.cache[supabasePath] = mockSupabaseModule;
  delete require.cache[require.resolve("./api/olx-prepare-image.js")];
  const handler = require("./api/olx-prepare-image.js");
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = (...args) => loggedErrors.push(args);

  try {
    await handler({
      method: "POST",
      headers: { authorization: `Bearer valid-token` },
      body: { propertyId, imageId }
    }, response);
    return { response, loggedErrors, propertyId, imageId };
  } finally {
    console.error = originalConsoleError;
    process.env = originalEnvironment;
    if (originalSupabaseModule) require.cache[supabasePath] = originalSupabaseModule;
    else delete require.cache[supabasePath];
    delete require.cache[require.resolve("./api/olx-prepare-image.js")];
  }
}

test("keeps a valid original without creating a derivative", async () => {
  const original = await sharp({
    create: { width: 960, height: 1280, channels: 3, background: "#d0d0d0" }
  }).jpeg().toBuffer();
  const prepared = await prepareOlxImage(original);

  assert.equal(prepared.optimized, false);
  assert.equal(prepared.buffer, original);
  assert.deepEqual([prepared.width, prepared.height], [960, 1280]);
  assert.deepEqual(await validateOlxImage(prepared.buffer), {
    contentType: "image/jpeg",
    width: 960,
    height: 1280
  });
});

test("resizes large images proportionally and strips EXIF orientation into pixels", async () => {
  const original = await sharp({
    create: { width: 4032, height: 3024, channels: 3, background: "#d0d0d0" }
  }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const prepared = await prepareOlxImage(original);
  const metadata = await sharp(prepared.buffer).metadata();

  assert.equal(prepared.optimized, true);
  assert.ok(prepared.buffer.length <= MAX_IMAGE_BYTES);
  assert.ok(prepared.buffer.length <= 4_900_000);
  assert.deepEqual([metadata.width, metadata.height], [2160, 2880]);
  assert.equal(metadata.orientation, undefined);
  assert.deepEqual(await validateOlxImage(prepared.buffer), {
    contentType: "image/jpeg",
    width: 2160,
    height: 2880
  });
});

test("authenticated preparation stores an optimized copy and preserves the original path", async () => {
  const original = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: "#d0d0d0" }
  }).jpeg().toBuffer();
  const imageId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const propertyId = "12345678-1234-1234-1234-123456789abc";
  const originalEnvironment = { ...process.env };
  process.env.VITE_SUPABASE_URL = "https://supabase.example";
  process.env.VITE_SUPABASE_ANON_KEY = "public-anon-key";

  const supabasePath = require.resolve("@supabase/supabase-js");
  const Module = require("node:module");
  const originalSupabaseModule = require.cache[supabasePath];
  const calls = { uploads: [], update: null, downloadPath: null };
  const mockSupabaseModule = new Module(supabasePath);
  mockSupabaseModule.filename = supabasePath;
  mockSupabaseModule.loaded = true;
  mockSupabaseModule.exports = {
    createClient: () => ({
      auth: { getUser: async (token) => ({ data: { user: token === "valid-token" ? { id: "admin-id" } : null }, error: null }) },
      from(table) {
        let updated;
        const builder = {
          select() { return builder; },
          update(value) { updated = value; calls.update = value; return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return {
              data: table === "admin_users"
                ? { user_id: "admin-id" }
                : {
                  id: imageId,
                  property_id: propertyId,
                  storage_path: `${propertyId}/original.jpg`,
                  olx_storage_path: null,
                  olx_ready: false
                },
              error: null
            };
          },
          then(resolve, reject) {
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
        };
        return builder;
      },
      storage: {
        from() {
          return {
            async download(path) {
              calls.downloadPath = path;
              return { data: new Blob([original]), error: null };
            },
            async upload(path, buffer, options) {
              calls.uploads.push({ path, buffer, options });
              return { error: null };
            }
          };
        }
      }
    })
  };
  require.cache[supabasePath] = mockSupabaseModule;
  delete require.cache[require.resolve("./api/olx-prepare-image.js")];
  const handler = require("./api/olx-prepare-image.js");

  try {
    const response = createResponse();
    await handler({
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: { propertyId, imageId }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      ready: true,
      optimized: true,
      width: 2160,
      height: 1620,
      bytes: calls.uploads[0].buffer.length
    });
    assert.equal(calls.downloadPath, `${propertyId}/original.jpg`);
    assert.equal(calls.uploads.length, 1);
    assert.equal(calls.uploads[0].path, `${propertyId}/olx/${imageId}.jpg`);
    assert.equal(calls.uploads[0].options.contentType, "image/jpeg");
    assert.deepEqual(calls.update, {
      olx_storage_path: `${propertyId}/olx/${imageId}.jpg`,
      olx_ready: true
    });
  } finally {
    process.env = originalEnvironment;
    if (originalSupabaseModule) require.cache[supabasePath] = originalSupabaseModule;
    else delete require.cache[supabasePath];
    delete require.cache[require.resolve("./api/olx-prepare-image.js")];
  }
});

test("preparation failures log image IDs and the failed stage without exposing details to the client", async () => {
  const original = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: "#d0d0d0" }
  }).jpeg().toBuffer();
  const failures = [
    { injection: "download", expectedStage: "download", imageBuffer: original },
    { injection: "conversion", expectedStage: "conversão", imageBuffer: Buffer.from("not an image") },
    { injection: "upload", expectedStage: "upload", imageBuffer: original },
    { injection: "update", expectedStage: "atualização no Supabase", imageBuffer: original }
  ];

  for (const { injection, expectedStage, imageBuffer } of failures) {
    const { response, loggedErrors, propertyId, imageId } =
      await invokePreparationFailure(injection, imageBuffer);
    const logContext = loggedErrors[0][1];

    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), {
      error: "Não foi possível preparar a imagem para a OLX."
    });
    assert.equal(logContext.propertyId, propertyId);
    assert.equal(logContext.imageId, imageId);
    assert.equal(logContext.stage, expectedStage);
    assert.ok(logContext.error instanceof Error);
  }
});

test("preparation endpoint rejects requests without an admin bearer token", async () => {
  const handler = require("./api/olx-prepare-image.js");
  const response = createResponse();

  await handler({
    method: "POST",
    headers: {},
    body: {
      propertyId: "12345678-1234-1234-1234-123456789abc",
      imageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /preparação inválidos/);
});
