import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { zipSync } from "fflate";

// Explicit allowlist prevents credentials, logs and local artifacts entering downloads.
const roots = [
  "src",
  "server",
  "scripts",
  "engine-build",
  ".github/workflows",
  "tests",
  "docs",
  "LICENSE",
  "README.md",
  "package.json",
  "package-lock.json",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.server.json",
  "wrangler.jsonc",
  "playwright.config.ts",
  "playwright.protected.config.ts",
  ".gitignore",
  "public/favicon.svg",
  "public/_headers",
  "public/licenses.html",
  "public/licenses",
];
const files = {};
async function add(path) {
  const { stat } = await import("node:fs/promises");
  if ((await stat(path)).isDirectory()) {
    for (const entry of await readdir(path)) {
      if (entry === "__pycache__") continue;
      await add(`${path}/${entry}`);
    }
  } else {
    files[`scad-to-3d/${path}`] = await readFile(path);
  }
}
for (const path of roots) await add(path);
await mkdir("public/source", { recursive: true });
await writeFile("public/source/scad-to-3d-source.zip", zipSync(files));
console.log(
  `Application source archive prepared (${Object.keys(files).length} files).`,
);
