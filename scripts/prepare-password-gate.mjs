import { copyFile, writeFile } from "node:fs/promises";
await copyFile("server/password-gate.mjs", "dist/_worker.js");
await writeFile(
  "dist/_routes.json",
  JSON.stringify({ version: 1, include: ["/*"], exclude: [] }, null, 2),
);
console.log(
  "Password gate included for every Pages route; no public asset exclusions.",
);
