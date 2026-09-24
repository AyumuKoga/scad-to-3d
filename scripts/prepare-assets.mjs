import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { unzipSync } from "fflate";

const url =
  "https://files.openscad.org/playground/OpenSCAD-2025.03.25.wasm24456-WebAssembly-web.zip";
const digest =
  "0968af31b9c9b3bba68d9031de1695ccae51c32231a1aab4ef27b18c86379f3b";
await mkdir("public/engine", { recursive: true });
await mkdir(".cache/openscad", { recursive: true });
let zip;
try {
  zip = await readFile(".cache/openscad/upstream.zip");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.log("Downloading pinned official OpenSCAD engine…");
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok)
    throw new Error(`OpenSCAD download failed: HTTP ${response.status}`);
  zip = new Uint8Array(await response.arrayBuffer());
}
if (createHash("sha256").update(zip).digest("hex") !== digest) {
  throw new Error("OpenSCAD archive checksum mismatch. Refusing to install.");
}
await writeFile(".cache/openscad/upstream.zip", zip);
const files = unzipSync(zip);
for (const name of ["openscad.js", "openscad.wasm"]) {
  if (!files[name]) throw new Error(`Missing engine file: ${name}`);
  await writeFile(`public/engine/${name}`, files[name]);
}
await mkdir("public/licenses/generated", { recursive: true });
for (const [pkg, file, target] of [
  ["three", "LICENSE", "three.txt"],
  ["vite", "LICENSE.md", "vite.txt"],
  ["typescript", "LICENSE.txt", "typescript.txt"],
  ["fflate", "LICENSE", "fflate.txt"],
  ["playwright-core", "LICENSE", "playwright.txt"],
]) {
  await copyFile(
    `node_modules/${pkg}/${file}`,
    `public/licenses/generated/${target}`,
  );
}
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const dependencies = Object.entries(lock.packages)
  .filter(([path]) => path)
  .map(([path, pkg]) => ({
    name: path.replace(/^node_modules\//, ""),
    version: pkg.version,
    license: pkg.license,
    developmentOnly: pkg.dev ?? false,
    optional: pkg.optional ?? false,
  }));
if (dependencies.some((entry) => !entry.license))
  throw new Error(
    "A locked dependency is missing license metadata. Review it before building.",
  );
await writeFile(
  "public/licenses/generated/dependencies.json",
  JSON.stringify(dependencies, null, 2),
);
console.log("OpenSCAD verified; engine and license assets ready.");
