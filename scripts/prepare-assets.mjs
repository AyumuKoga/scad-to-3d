import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";

await import("./prepare-engine.mjs");
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
