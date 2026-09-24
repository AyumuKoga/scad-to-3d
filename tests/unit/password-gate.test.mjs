import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import gate from "../../server/password-gate.mjs";

const credential = `scad:${randomBytes(24).toString("base64url")}`;
const SITE_AUTH_SHA256 = createHash("sha256").update(credential).digest("hex");
const header = `Basic ${btoa(credential)}`;

test("missing configuration, absent/wrong/malformed passwords never read assets", async () => {
  const assets = { fetch: () => assert.fail("Unauthenticated asset access") };
  const request = (authorization) =>
    new Request("https://site.pages.dev/engine/openscad.wasm", {
      headers: authorization ? { Authorization: authorization } : {},
    });
  assert.equal(
    (await gate.fetch(request(header), { ASSETS: assets })).status,
    503,
  );
  for (const auth of [
    undefined,
    "Basic !!!",
    "Bearer token",
    "Basic " + btoa("scad:wrong"),
    "Basic Y",
    "Basic " + "a".repeat(2000),
  ]) {
    const response = await gate.fetch(request(auth), {
      SITE_AUTH_SHA256,
      ASSETS: assets,
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("WWW-Authenticate"), /^Basic /);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  }
});

test("valid credentials protect all paths and are stripped from asset requests", async () => {
  for (const path of [
    "/",
    "/index.html",
    "/assets/main.js",
    "/engine/openscad.wasm",
    "/licenses.html",
    "/unknown?path=public",
  ]) {
    const response = await gate.fetch(
      new Request(`https://site.pages.dev${path}`, {
        headers: { Authorization: header },
      }),
      {
        SITE_AUTH_SHA256,
        ASSETS: {
          fetch: async (request) => {
            assert.equal(request.headers.has("Authorization"), false);
            assert.equal(new URL(request.url).pathname, path.split("?")[0]);
            return new Response("protected", {
              headers: { Vary: "Accept-Encoding" },
            });
          },
        },
      },
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "protected");
    assert.match(response.headers.get("Vary"), /Accept-Encoding/);
    assert.match(response.headers.get("Vary"), /Authorization/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  }
});

test("an asset failure remains closed and authenticated writes are rejected", async () => {
  const env = {
    SITE_AUTH_SHA256,
    ASSETS: {
      fetch: async () => {
        throw Error("offline");
      },
    },
  };
  assert.equal(
    (
      await gate.fetch(
        new Request("https://site.pages.dev/", {
          headers: { Authorization: header },
        }),
        env,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await gate.fetch(
        new Request("https://site.pages.dev/", {
          method: "POST",
          headers: { Authorization: header },
        }),
        env,
      )
    ).status,
    405,
  );
  const redirect = await gate.fetch(new Request("http://site.pages.dev/"), env);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("Location"), "https://site.pages.dev/");
});
