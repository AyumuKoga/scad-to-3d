import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "production-csp",
      apply: "build",
      transformIndexHtml(html) {
        return html.replace(" ws://127.0.0.1:* ws://localhost:*", "");
      },
    },
  ],
  worker: { format: "es" },
  build: { target: ["es2022", "safari16.4"], chunkSizeWarningLimit: 700 },
});
