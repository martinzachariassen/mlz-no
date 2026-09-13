/**
 * The site's palette, read out of public/css/tokens.css.
 *
 * Figures need it because an SVG loaded through <img> is its own document and
 * cannot see the page's custom properties or [data-theme] — render.js paints a
 * `-light` and a `-dark` copy of every figure from these values instead. The
 * <meta name="theme-color"> tags need it for the same reason in reverse: that
 * is markup, not CSS, so it cannot reference var(--bg) and has to carry the
 * literal colour.
 *
 * Reading the stylesheet rather than keeping a copy in content/ is the whole
 * point: tokens.css stays the one place a colour on this site is written down.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ContentError } from "./content-schema.js";
import { publicDir, rel } from "./paths.js";

/**
 * Figures use `{{camelCaseToken}}` placeholders naming a colour; this maps
 * each one to the `--kebab-case` custom property it reads from
 * public/css/tokens.css. Kept as an explicit table (rather than mechanically
 * deriving the name) so a figure's token names stay meaningful on their own
 * — "warm" reads better than "glitch2" to someone drawing a diagram, even
 * though the colour is also used for the hero's glitch effect.
 */
const TOKEN_ALIASES = {
  bg: "bg",
  surface: "surface",
  sunken: "sunken",
  fg: "fg",
  "fg-secondary": "fgSecondary",
  "fg-muted": "muted",
  border: "border",
  accent: "accent",
  "accent-deep": "accentDeep",
  "glitch-2": "warm",
};

/**
 * Parses the `:root` and `[data-theme="dark"]` custom properties straight
 * out of public/css/tokens.css. Dark values that aren't overridden inherit
 * from light, the same way the real cascade works.
 */
export function readTokens(path = join(publicDir, "css", "tokens.css")) {
  // Stripped before the block regexes run: a `}` inside a comment would
  // otherwise truncate the [^}]* capture right there.
  const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  const block = (label, pattern) => {
    const match = css.match(pattern);
    if (!match) throw new ContentError(`${rel(path)}: no ${label} block found`);
    const vars = {};
    for (const [, name, value] of match[1].matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    )) {
      vars[name] = value.trim();
    }
    return vars;
  };

  const rootVars = block(":root", /:root\s*{([^}]*)}/);
  const darkVars = {
    ...rootVars,
    ...block('[data-theme="dark"]', /\[data-theme="dark"\]\s*{([^}]*)}/),
  };

  const alias = (vars) => {
    const out = {};
    for (const [kebab, token] of Object.entries(TOKEN_ALIASES)) {
      if (vars[kebab] === undefined) {
        throw new ContentError(
          `${rel(path)}: missing --${kebab} (needed for palette token "${token}")`,
        );
      }
      out[token] = vars[kebab];
    }
    return out;
  };

  return { light: alias(rootVars), dark: alias(darkVars) };
}
