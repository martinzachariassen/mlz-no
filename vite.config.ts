import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `public/` is copied to the dist root verbatim, so favicons, robots.txt,
// sitemap.xml, the manifest, and _headers keep their well-known URLs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 4173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    target: "es2022",
    // Content-hashed output goes to dist/bundle/ rather than Vite's default
    // dist/assets/, which public/assets/ (favicons, social cards) already
    // occupies. Keeping them apart lets public/_headers mark /bundle/* as
    // immutable without also freezing a favicon that has a stable URL.
    assetsDir: "bundle",
    // Drop Vite's inline modulePreload polyfill so the built HTML carries no
    // inline <script>, keeping the CSP's script-src at a strict 'self'.
    modulePreload: { polyfill: false },
  },
});
