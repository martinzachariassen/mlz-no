import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server mirrors the production port (4173). `public/` is copied to the
// dist root verbatim, so favicons, robots.txt, sitemap.xml, and the manifest
// keep their well-known URLs.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    target: "es2022",
    // Drop Vite's inline modulePreload polyfill so the built HTML carries no
    // inline <script>, keeping the server's CSP script-src at a strict 'self'.
    modulePreload: { polyfill: false },
  },
});
