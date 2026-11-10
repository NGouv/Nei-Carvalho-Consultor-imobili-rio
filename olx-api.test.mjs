import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalEnvironment = { ...process.env };
process.env.VITE_SUPABASE_URL = "https://supabase.example";
process.env.VITE_SUPABASE_ANON_KEY = "public-anon-key";
const supabasePackagePath = require.resolve("@supabase/supabase-js");
const originalSupabasePackage = require.cache[supabasePackagePath];
let mockClient;
const mockSupabaseModule = new Module(supabasePackagePath);
mockSupabaseModule.filename = supabasePackagePath;
mockSupabaseModule.loaded = true;
mockSupabaseModule.exports = { createClient: () => mockClient };
require.cache[supabasePackagePath] = mockSupabaseModule;

const feedHandler = require("./api/olx-feed.js");
const imageHandler = require("./api/olx-image.js");

if (originalSupabasePackage) require.cache[supabasePackagePath] = originalSupabasePackage;
else delete require.cache[supabasePackagePath];
after(() => {
  process.env = originalEnvironment;
});

const property = {
  id: "12345678-1234-1234-1234-123456789abc",
  title: "Casa publicada",
  property_type: "Casa",
  purpose: "sale",
  price: 350000,
  condominium: null,
  cep: "18035000",
  city: "Sorocaba",
  neighborhood: "Centro",
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  total_area: 90,
  description: "Descrição válida",
  features: [],
  property_images: [{
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    display_order: 0,
    is_primary: true,
    olx_ready: true,
    olx_storage_path: null
  }]
};

function createSupabaseMock({
  propertyData = [property],
  imageData = null,
  publishedPropertyData = { id: property.id },
  file = null
} = {}) {
  const queries = [];
  const signedUrlRequests = [];
  const client = {
    queries,
    downloads: [],
    from(table) {
      const query = { table, filters: [], selection: "" };
      queries.push(query);
      const builder = {
        select(selection) {
          query.selection = selection;
          return builder;
        },
        eq(column, value) {
          query.filters.push([column, value]);
          return builder;
        },
        order() {
          return builder;
        },
        range() {
          return Promise.resolve({ data: propertyData, error: null });
        },
        maybeSingle() {
          const data = table === "property_images" ? imageData : publishedPropertyData;
          return Promise.resolve({ data, error: null });
        }
      };
      return builder;
    },
    storage: {
      from(bucket) {
        return {
          async download(path) {
            client.downloads.push({ bucket, path });
            return { data: file || new Blob(["not-an-image"]), error: null };
          }
        };
      }
    }
  };
  return client;
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: "",
    chunks: [],
    headersSent: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    write(body) {
      this.headersSent = true;
      this.chunks.push(Buffer.from(body));
      return true;
    },
    once() {},
    end(body = "") {
      if (body.length) this.chunks.push(Buffer.from(body));
      if (this.chunks.length) this.body = Buffer.concat(this.chunks);
      else this.body = body;
      this.headersSent = true;
    },
    destroy(error) {
      this.error = error;
    }
  };
}

test("feed GET queries published property fields and returns official XML", async () => {
  mockClient = createSupabaseMock();
  process.env.PUBLIC_SITE_URL = "https://feed.example/";
  const response = createResponse();

  await feedHandler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/xml; charset=utf-8");
  const xml = response.body.toString("utf8");
  assert.match(xml, /<Carga[\s\S]*<CodigoImovel>12345678123412341234<\/CodigoImovel>/);
  assert.match(xml, /<CEP>18035000<\/CEP>/);
  assert.deepEqual(mockClient.queries[0].filters, [["status", "published"]]);
  assert.match(mockClient.queries[0].selection, /cep/);
  assert.match(mockClient.queries[0].selection, /property_images\(id,display_order,is_primary,olx_ready\)/);
});

test("image URL serves a ready image directly for a published property", async () => {
  const sharp = require("sharp");
  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#d0d0d0" }
  }).jpeg().toBuffer();
  mockClient = createSupabaseMock({
    propertyData: [],
    imageData: {
      storage_path: `${property.id}/photo.jpg`,
      olx_storage_path: null,
      olx_ready: true
    },
    file: new Blob([image], { type: "image/jpeg" })
  });
  const response = createResponse();

  await imageHandler({
    method: "GET",
    query: { propertyId: property.id, imageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.location, undefined);
  assert.equal(response.headers["content-type"], "image/jpeg");
  assert.equal(response.headers["content-length"], String(image.length));
  assert.deepEqual(response.body, image);
  assert.deepEqual(mockClient.downloads, [{
    bucket: "property-photos",
    path: `${property.id}/photo.jpg`
  }]);
  assert.deepEqual(mockClient.queries[1].filters, [["id", property.id], ["status", "published"]]);
});

test("image URL does not expose photos of unpublished properties", async () => {
  mockClient = createSupabaseMock({
    propertyData: [],
    imageData: { storage_path: `${property.id}/photo.jpg`, olx_ready: true },
    publishedPropertyData: null
  });
  const response = createResponse();

  await imageHandler({
    method: "GET",
    query: { propertyId: property.id, imageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }
  }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(mockClient.downloads.length, 0);
});

test("image URL does not expose photos that are not OLX-ready", async () => {
  mockClient = createSupabaseMock({
    propertyData: [],
    imageData: { storage_path: `${property.id}/photo.jpg`, olx_ready: false }
  });
  const response = createResponse();

  await imageHandler({
    method: "GET",
    query: { propertyId: property.id, imageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }
  }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(mockClient.downloads.length, 0);
});

test("image URL serves the optimized copy instead of the original when configured", async () => {
  const sharp = require("sharp");
  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#d0d0d0" }
  }).jpeg().toBuffer();
  mockClient = createSupabaseMock({
    propertyData: [],
    imageData: {
      storage_path: `${property.id}/original.avif`,
      olx_storage_path: `${property.id}/olx/optimized.jpg`,
      olx_ready: true
    },
    file: new Blob([image], { type: "image/jpeg" })
  });
  const response = createResponse();

  await imageHandler({
    method: "GET",
    query: { propertyId: property.id, imageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(mockClient.downloads, [{
    bucket: "property-photos",
    path: `${property.id}/olx/optimized.jpg`
  }]);
});

test("image URL rejects malformed identifiers", async () => {
  mockClient = createSupabaseMock();
  const response = createResponse();

  await imageHandler({ method: "GET", query: { propertyId: "invalid", imageId: "invalid" } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(mockClient.queries.length, 0);
});
