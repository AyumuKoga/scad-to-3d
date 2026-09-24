import { randomBytes, createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";

for (const path of [
  ".secrets/site-credentials.txt",
  ".dev.vars",
  ".secrets/cloudflare-secrets.json",
]) {
  try {
    await access(path);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  throw new Error(
    `Existing credentials found at ${path}; refusing to replace them.`,
  );
}

await mkdir(".secrets", { recursive: true, mode: 0o700 });
const password = randomBytes(24).toString("base64url");
const digest = createHash("sha256").update(`scad:${password}`).digest("hex");
// Exclusive creation prevents an accidental rerun from changing existing credentials.
await writeFile(
  ".secrets/site-credentials.txt",
  `ユーザー名: scad\nパスワード: ${password}\n`,
  { mode: 0o600, flag: "wx" },
);
await writeFile(".dev.vars", `SITE_AUTH_SHA256="${digest}"\n`, {
  mode: 0o600,
  flag: "wx",
});
await writeFile(
  ".secrets/cloudflare-secrets.json",
  JSON.stringify({ SITE_AUTH_SHA256: digest }),
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Credentials generated in .secrets/site-credentials.txt (owner-readable only). No secret values printed.",
);
