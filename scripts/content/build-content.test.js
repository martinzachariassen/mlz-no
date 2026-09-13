import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkAssetLinks,
  findStrays,
  publicDir,
  readTokens,
  spliceChrome,
} from "./build-content.js";
import { ContentError } from "./content-schema.js";

/**
 * checkAssetLinks is what catches a typo'd href/src before it ships as a
 * silent broken link — see build-content.js's own comment on it. The one
 * way it used to get this wrong: a protocol-relative URL ("//host/path")
 * also starts with "/", so it was briefly indistinguishable from a
 * root-relative path on this site and got checked against public/ instead
 * of being treated as external.
 */

const site = { origin: "https://example.com" };

/** A page containing the given refs, keyed the way build-content.js keys outputs. */
const page = (body) =>
  new Map([[join(publicDir, "/test-page.html"), `<!doctype html>${body}`]]);

describe("checkAssetLinks", () => {
  test("does not flag a protocol-relative URL as a broken local link", () => {
    const broken = checkAssetLinks(
      page('<script src="//cdn.example.com/lib.js"></script>'),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("flags a root-relative href that resolves to no file on disk", () => {
    const broken = checkAssetLinks(
      page('<link rel="stylesheet" href="/css/does-not-exist.css" />'),
      site,
    );
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain("/css/does-not-exist.css");
  });

  test("does not flag a root-relative href that resolves to a real file", () => {
    const broken = checkAssetLinks(
      page('<link rel="stylesheet" href="/css/tokens.css" />'),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("does not flag an off-site https:// link", () => {
    const broken = checkAssetLinks(
      page('<a href="https://other-site.example/page">x</a>'),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("flags a broken JSON-LD url field, not just href/src", () => {
    const broken = checkAssetLinks(
      page(
        '<script type="application/ld+json">{\n  "url": "https://example.com/projects/does-not-exist"\n}</script>',
      ),
      site,
    );
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain("/projects/does-not-exist");
  });

  test("does not flag a JSON-LD url that resolves", () => {
    const broken = checkAssetLinks(
      page(
        '<script type="application/ld+json">{\n  "url": "https://example.com/css/tokens.css"\n}</script>',
      ),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("treats a stray file scheduled for removal as not resolving", () => {
    const strayPath = join(publicDir, "css", "tokens.css");
    const broken = checkAssetLinks(
      page('<link rel="stylesheet" href="/css/tokens.css" />'),
      site,
      new Set([strayPath]),
    );
    expect(broken).toHaveLength(1);
  });
});

/**
 * spliceChrome is the only thing standing between an edit inside a
 * <!-- generated:name --> region and it silently going stale — see its own
 * comment in build-content.js. Both error paths matter as much as the happy
 * path: a region naming an unknown block, and a block with no region to land
 * in, are the two ways that guarantee can quietly break.
 */
describe("spliceChrome", () => {
  test("replaces a region's body with the named block, re-indented to the marker", () => {
    const source = [
      "<body>",
      "  <!-- generated:topbar -->",
      "  <p>stale</p>",
      "  <!-- /generated:topbar -->",
      "</body>",
    ].join("\n");
    const out = spliceChrome(
      source,
      { topbar: "<nav>fresh</nav>\n<a>link</a>" },
      "test.html",
    );
    expect(out).toBe(
      [
        "<body>",
        "  <!-- generated:topbar -->",
        "  <nav>fresh</nav>",
        "  <a>link</a>",
        "  <!-- /generated:topbar -->",
        "</body>",
      ].join("\n"),
    );
  });

  test("throws when a region names a block that doesn't exist", () => {
    const source = [
      "<!-- generated:typo -->",
      "x",
      "<!-- /generated:typo -->",
    ].join("\n");
    expect(() => spliceChrome(source, { topbar: "x" }, "test.html")).toThrow(
      ContentError,
    );
  });

  test("throws when a block has no matching region", () => {
    const source = [
      "<!-- generated:topbar -->",
      "x",
      "<!-- /generated:topbar -->",
    ].join("\n");
    expect(() =>
      spliceChrome(source, { topbar: "x", footer: "y" }, "test.html"),
    ).toThrow(ContentError);
  });
});

/**
 * findStrays is what notices a renamed/removed project left its old case
 * study on disk. It's exercised end-to-end by `bun run check:content`
 * against the real content/ and public/ trees, but that never runs with a
 * stray file present — this drives it directly instead of leaving that path
 * only covered by the accident of nobody renaming a project mid-review.
 */
describe("findStrays", () => {
  const site = { basePath: "/projects", figureDir: "/assets/figures" };

  /** Every real file under the two managed directories, as an outputs Map. */
  const realOutputs = () => {
    const dirs = [
      join(publicDir, site.basePath),
      join(publicDir, site.figureDir),
    ];
    const outputs = new Map();
    for (const dir of dirs) {
      for (const entry of readdirSync(dir, {
        recursive: true,
        withFileTypes: true,
      })) {
        if (entry.isFile()) {
          outputs.set(join(entry.parentPath, entry.name), "");
        }
      }
    }
    return outputs;
  };

  test("finds nothing stray when outputs cover every file on disk", () => {
    expect(findStrays(realOutputs(), site)).toEqual([]);
  });

  test("flags a file on disk that outputs doesn't account for", () => {
    const outputs = realOutputs();
    const [strayPath] = outputs.keys();
    outputs.delete(strayPath);
    expect(findStrays(outputs, site)).toEqual([strayPath]);
  });

  test("ignores directories that don't exist on disk", () => {
    expect(
      findStrays(new Map(), { basePath: "/no-such-dir", figureDir: "/nope" }),
    ).toEqual([]);
  });
});

/**
 * readTokens is figures' only path to the page's real colours (see its own
 * comment in build-content.js: an SVG loaded via <img> can't see [data-theme]).
 * These pin the two failure modes a future tokens.css edit could hit
 * silently otherwise: a renamed/removed custom property, and the
 * dark-inherits-light behaviour that mirrors the real cascade.
 */
describe("readTokens", () => {
  test("reads the real tokens.css and inherits unset dark values from light", () => {
    const { light, dark } = readTokens();
    // --accent isn't redefined under [data-theme="dark"], so it must fall
    // back to the light value exactly like the real CSS cascade would.
    expect(dark.accent).toBe(light.accent);
    // --accent-deep is redefined for dark, so it must differ from light.
    expect(dark.accentDeep).not.toBe(light.accentDeep);
  });

  test("throws a ContentError when a required custom property is missing", () => {
    const path = join(tmpdir(), `tokens-missing-${Date.now()}.css`);
    writeFileSync(path, ":root {\n  --bg: oklch(0.95 0.006 250);\n}\n");
    try {
      expect(() => readTokens(path)).toThrow(ContentError);
    } finally {
      rmSync(path);
    }
  });

  test("throws a ContentError when the :root block is missing entirely", () => {
    const path = join(tmpdir(), `tokens-no-root-${Date.now()}.css`);
    writeFileSync(path, "body { color: red; }\n");
    try {
      expect(() => readTokens(path)).toThrow(ContentError);
    } finally {
      rmSync(path);
    }
  });
});

/**
 * Two files under public/ can't reference tokens.css's custom properties and
 * therefore carry hand-maintained hex copies of the palette, which no other
 * test and none of the build's own checks would notice drifting:
 *
 *   site.webmanifest   the Web Manifest spec is plain JSON — background_color
 *                      and theme_color are literal colours, both --bg
 *   favicon.svg        loaded through <link rel="icon">, so it is its own
 *                      document and cannot see the page's custom properties;
 *                      it carries --fg for each theme, picked with its own
 *                      prefers-color-scheme query
 *
 * These convert the real token to sRGB the same way a browser would and pin
 * it against what each file says, so a palette change that forgets one fails
 * loudly instead of silently. The favicon's dark value had drifted to the
 * light --bg hex before this covered it.
 */
describe("hand-maintained colour copies", () => {
  /** Per Björn Ottosson's OKLab reference conversion to sRGB. */
  function oklchToHex(oklch) {
    const [, L, C, H] = oklch.match(
      /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/,
    );
    const h = (Number(H) * Math.PI) / 180;
    const a = Number(C) * Math.cos(h);
    const b = Number(C) * Math.sin(h);
    const l_ = Number(L) + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = Number(L) - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = Number(L) - 0.0894841775 * a - 1.291485548 * b;
    const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const toSrgb = (c) => {
      c = Math.min(1, Math.max(0, c));
      return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    };
    const toHex = (c) =>
      Math.round(toSrgb(c) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${lin.map(toHex).join("")}`;
  }

  test("the manifest's background_color and theme_color match --bg's light value", () => {
    const manifest = JSON.parse(
      readFileSync(join(publicDir, "assets", "site.webmanifest"), "utf8"),
    );
    const { light } = readTokens();
    const bgHex = oklchToHex(light.bg);
    expect(manifest.background_color).toBe(bgHex);
    expect(manifest.theme_color).toBe(bgHex);
  });

  test("the favicon's two fills match --fg in each theme", () => {
    const svg = readFileSync(
      join(publicDir, "assets", "icons", "favicon.svg"),
      "utf8",
    );
    // The dark fill is the one inside the prefers-color-scheme block; the
    // light fill is the rule before it.
    const [light, dark] = [...svg.matchAll(/fill:\s*(#[0-9a-f]{6})/g)].map(
      ([, hex]) => hex,
    );
    const tokens = readTokens();
    expect(light).toBe(oklchToHex(tokens.light.fg));
    expect(dark).toBe(oklchToHex(tokens.dark.fg));
  });
});
