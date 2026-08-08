import { themeInitScript } from "@martinzachariassen/design";
import type { Plugin } from "vite";

/** The comment both HTML entrypoints carry, replaced with the real <script>. */
const MARKER = "<!--theme-init-->";

/** Dev-server URL. In a build the script becomes a hashed asset under /bundle/. */
const DEV_URL = "/@mlz-theme-init.js";

/**
 * Ships the design system's pre-paint theme bootstrap as a standalone,
 * content-hashed, same-origin script and splices it into index.html and
 * 404.html where the `<!--theme-init-->` marker sits.
 *
 * The script has to run before the first paint, or a reader who chose dark mode
 * sees a white flash on every load. The design system's own JSDoc says to inline
 * it with `dangerouslySetInnerHTML` — but public/_headers pins script-src to
 * 'self' with no 'unsafe-inline' (the same reason build.modulePreload.polyfill
 * is off), and a static-asset Worker has no server to mint a nonce or hash. A
 * file under /bundle/ satisfies the CSP, inherits the immutable Cache-Control,
 * and — being a classic script rather than a module — still blocks the parser,
 * so `.dark` and `data-accent` are on <html> before anything renders.
 *
 * The string is generated from the installed package at build time, so it can
 * never drift from the ThemeProvider it has to agree with. Both are used with
 * their defaults (mlz-theme / mlz-accent / class); change one and you must
 * change the other.
 */
export function themeInit(): Plugin {
  const source = themeInitScript();
  let src = DEV_URL;

  return {
    name: "mlz:theme-init",

    // Emit here rather than in generateBundle: an asset's final hashed name is
    // available as soon as its source is set, and renderStart runs before
    // vite:build-html rewrites the HTML.
    renderStart() {
      const ref = this.emitFile({
        type: "asset",
        name: "theme-init.js",
        source,
      });
      src = `/${this.getFileName(ref)}`;
    },

    configureServer(server) {
      server.middlewares.use(DEV_URL, (_req, res) => {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(source);
      });
    },

    transformIndexHtml: {
      // "post" so this runs after renderStart has resolved the hashed name.
      order: "post",
      handler(html) {
        return html.replace(MARKER, `<script src="${src}"></script>`);
      },
    },
  };
}
