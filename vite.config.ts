import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { themeInit } from "./vite/theme-init";

export default defineConfig({
  plugins: [react(), tailwindcss(), themeInit()],
  server: { host: "127.0.0.1", port: 4173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    target: "es2022",
    // Content-hashed output goes to dist/bundle/ rather than Vite's default
    // dist/assets/, which public/assets/ (favicons, social cards) already
    // occupies. Keeping them apart lets firebase.json mark /bundle/* as
    // immutable without also freezing a favicon that has a stable URL.
    assetsDir: "bundle",
    // Drop Vite's inline modulePreload polyfill so the built HTML carries no
    // inline <script>, keeping the CSP's script-src at a strict 'self'.
    modulePreload: { polyfill: false },
    // Multi-page build: index.html is the site; 404.html builds to dist/404.html,
    // which Firebase Hosting serves with a 404 status for unknown paths — that
    // filename is the whole contract, there is no config key for it. Paths
    // resolve from the config root, so no Node path helpers are needed.
    rollupOptions: {
      input: {
        main: "index.html",
        notFound: "404.html",
      },
    },
  },
});
