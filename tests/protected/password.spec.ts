import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("every file requires authentication, including the 3D engine", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/engine/openscad.js",
    "/engine/openscad.wasm",
    "/licenses.html",
    "/source/",
    "/source/scad-to-3d-source.zip",
    "/source/source-parts.json",
    "/source/engine-source.tar.xz.part001",
    "/favicon.svg",
    "/unknown",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Basic");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
  const wrong = await request.get("/", {
    headers: { Authorization: `Basic ${btoa("scad:wrong")}` },
  });
  expect(wrong.status()).toBe(401);
});

test("authorized browsers can render and download through the password gate", async ({
  browser,
  baseURL,
}) => {
  const credentials = await readFile(".secrets/site-credentials.txt", "utf8");
  const password = /^パスワード: (.+)$/m.exec(credentials)?.[1];
  if (!password) throw new Error("Local test credentials unavailable");
  const context = await browser.newContext({
    httpCredentials: { username: "scad", password },
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(baseURL!);
    expect(response?.status()).toBe(200);
    await page.locator("#code").fill("cube([10,20,30]);");
    await page.locator("#generate").click();
    await expect(page.locator("#download")).toBeEnabled();
    await expect(page.locator("#dimensions")).toHaveText(
      "X 1 cm · Y 2 cm · Z 3 cm",
    );
    const pending = page.waitForEvent("download");
    await page.locator("#download").click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("model.stl");
    const file = await download.path();
    expect(file).toBeTruthy();
    const bytes = await readFile(file!);
    expect(bytes.readUInt32LE(80)).toBe(12);
    expect(bytes.length).toBe(84 + 12 * 50);
    const sourcePage = await context.request.get(`${baseURL}/source/`);
    expect(sourcePage.status()).toBe(200);
    expect(await sourcePage.text()).toContain("対応するソース");
    const manifestResponse = await context.request.get(`${baseURL}/source/source-parts.json`);
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.completeSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.parts.length).toBeGreaterThan(0);
    for (const part of manifest.parts) {
      expect(part.file).toMatch(/^engine-source\.tar\.xz\.part\d{3}$/);
      // HEAD checks availability without downloading the 287 MB archive in
      // each browser. Complete remote hashes are verified separately at release.
      const response = await context.request.head(`${baseURL}/source/${part.file}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/octet-stream");
      const length = response.headers()["content-length"];
      if (length !== undefined) expect(Number(length)).toBe(part.bytes);
      await response.dispose();
    }
  } finally {
    await context.close();
  }
});
