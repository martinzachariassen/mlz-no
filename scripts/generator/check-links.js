/**
 * Every root-relative href/src/og:image/JSON-LD url the written pages emit
 * must resolve to a real file — either something the run writes (a figure, a
 * case study page) or something already on disk (a stylesheet, an icon).
 *
 * This isn't a content/ check, which is why it lives outside content-schema.js:
 * a broken link is just as likely to come from a typo in render.js's own
 * hardcoded <head>/<script>/JSON-LD markup, which the spec never sees, as from
 * content/site.json's ogImage. It runs on the finished output instead, so it
 * catches both.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { publicDir, rel } from "./paths.js";

const STATIC_EXTENSION = /\.[a-z0-9]+$/i;
const REFERENCE =
  /\s(?:href|src)="([^"]+)"|<loc>([^<]+)<\/loc>|property="og:image"\s+content="([^"]+)"|"url":\s*"([^"]+)"/g;

/**
 * @param {Map<string, string>} outputs every file the run will write, keyed by
 *   absolute path — both the sources to scan and part of what a link may
 *   resolve to, since a page can link to another page this same run generates.
 * @param {Set<string>} strays absolute paths findStrays() has already marked
 *   for removal — excluded from `existsSync` so a link is checked against the
 *   post-cleanup state of public/, not whatever this run hasn't deleted yet.
 */
export function checkAssetLinks(outputs, site, strays = new Set()) {
  /** A root-relative site path from a ref, or null if it's not this site's. */
  const localAssetPath = (ref) => {
    const path = ref.split("#")[0].split("?")[0];
    if (path.startsWith(`${site.origin}/`)) {
      return path.slice(site.origin.length);
    }
    // A protocol-relative URL ("//cdn.example/x.js") also starts with "/",
    // but it names a different host, not a root-relative path on this one.
    if (path.startsWith("/") && !path.startsWith("//")) return path;
    return null; // external, mailto:, tel: — not something public/ can serve
  };

  /**
   * Mirrors how `cleanUrls` in firebase.json actually resolves a path: a
   * static asset needs the exact file, but a route like `/projects/foo` is
   * served from either `foo.html` or `foo/index.html`, whichever exists.
   */
  const resolvesToFile = (path) => {
    const target = join(publicDir, path);
    const has = (candidate) =>
      outputs.has(candidate) ||
      (existsSync(candidate) && !strays.has(candidate));
    if (STATIC_EXTENSION.test(path)) return has(target);
    return has(`${target}.html`) || has(join(target, "index.html"));
  };

  const broken = [];
  for (const [path, source] of outputs) {
    if (!/\.(?:html|xml)$/.test(path)) continue;
    for (const match of source.matchAll(REFERENCE)) {
      const ref = match[1] ?? match[2] ?? match[3] ?? match[4];
      const local = localAssetPath(ref);
      if (local !== null && !resolvesToFile(local)) {
        broken.push(`${rel(path)}: broken link to ${ref}`);
      }
    }
  }
  return broken;
}
