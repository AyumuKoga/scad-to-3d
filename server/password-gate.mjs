import { createHash, timingSafeEqual } from "node:crypto";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
};

/** @param {Response} response */
function secure(response) {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(responseHeaders))
    result.headers.set(name, value);
  result.headers.append("Vary", "Authorization");
  return result;
}

function denied() {
  return secure(
    new Response("利用にはユーザー名 scad と共有パスワードが必要です。", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="SCAD to 3D", charset="UTF-8"',
      },
    }),
  );
}

export default {
  /** @param {Request} request @param {Env & { ASSETS: Fetcher }} env */
  async fetch(request, env) {
    // A missing/invalid secret must never turn off authentication.
    if (!/^[a-f0-9]{64}$/.test(env.SITE_AUTH_SHA256 ?? "")) {
      return secure(new Response("サイトの準備中です。", { status: 503 }));
    }
    const url = new URL(request.url);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      url.protocol = "https:";
      return secure(Response.redirect(url.href, 308));
    }
    const header = request.headers.get("Authorization") ?? "";
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
    if (header.length > 1024 || !match) return denied();
    let credentials;
    try {
      credentials = atob(match[1]);
    } catch {
      return denied();
    }
    const supplied = createHash("sha256").update(credentials, "utf8").digest();
    const expected = Uint8Array.from(
      env.SITE_AUTH_SHA256.match(/../g) ?? [],
      (value) => Number.parseInt(value, 16),
    );
    if (!timingSafeEqual(supplied, expected)) return denied();
    if (!["GET", "HEAD"].includes(request.method)) {
      return secure(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        }),
      );
    }
    try {
      // Do not pass credentials into the static asset service or any external origin.
      const headers = new Headers(request.headers);
      headers.delete("Authorization");
      return secure(await env.ASSETS.fetch(new Request(request, { headers })));
    } catch {
      // Authentication failures and asset errors must not fall back to public files.
      return secure(
        new Response(
          "読み込みに失敗しました。時間をおいて再度お試しください。",
          { status: 503 },
        ),
      );
    }
  },
};
