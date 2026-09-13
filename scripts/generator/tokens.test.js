import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContentError } from "./content-schema.js";
import { publicDir } from "./paths.js";
import { readTokens } from "./tokens.js";

/**
 * readTokens is figures' only path to the page's real colours (see tokens.js's
 * own comment: an SVG loaded via <img> can't see [data-theme]). These pin the
 * two failure modes a future tokens.css edit could hit silently otherwise: a
 * renamed/removed custom property, and the dark-inherits-light behaviour that
 * mirrors the real cascade.
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
