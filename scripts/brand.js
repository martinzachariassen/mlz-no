// Generates the brand files in public/brand/ from public/brand/tokens.json,
// the single source for colour, type, shape and motion.
//
//   bun run brand         fill in hex values, regenerate everything
//   bun run brand:check   exit 1 if anything is out of date (used in CI)
//
// Outputs: tokens.json (hex filled in), tokens.css, tailwind.css, brand.json
// and the colour table in BRAND.md (between the tokens:start/end markers).
// No dependencies beyond Bun; the CSS is passed through the repo's own Biome
// so the generated files pass `bun run lint` as-is.

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const BRAND = join(ROOT, "public/brand");
const SITE = "https://mlz.no";
const REPO = "martinzachariassen/mlz-no";
const AA = 4.5;

const check = process.argv.includes("--check");
const path = (file) => join(BRAND, file);
const url = (file) => `${SITE}/brand/${file}`;

// --- Colour maths (OKLCH → sRGB, WCAG contrast) -----------------------------

function oklchToLinearRgb([L, C, h]) {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

const encode = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hex(components) {
  return `#${oklchToLinearRgb(components)
    .map((c) =>
      Math.round(encode(c) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Luminance from the 8-bit hex, so the ratio matches what any checker reports.
function luminance(hexValue) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hexValue.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- Read and enrich the source ---------------------------------------------

const tokens = await Bun.file(path("tokens.json")).json();
const meta = tokens.$extensions["no.mlz"];
const version = meta.version;
const tag = `brand-v${version}`;
const pinned = `https://cdn.jsdelivr.net/gh/${REPO}@${tag}/public/brand/`;

const THEMES = ["light", "dark"];
const errors = [];
const colors = {}; // theme → [{ name, components, hex, text, description }]

for (const theme of THEMES) {
  colors[theme] = Object.entries(tokens.color[theme])
    .filter(([name]) => !name.startsWith("$"))
    .map(([name, token]) => {
      const value = token.$value;
      if (value.colorSpace !== "oklch") {
        errors.push(`color.${theme}.${name}: colorSpace must be "oklch"`);
      }
      value.hex = hex(value.components);
      return {
        name,
        components: value.components,
        hex: value.hex,
        text: token.$extensions?.["no.mlz"]?.text === true,
        description: token.$description,
      };
    });
}

for (const theme of THEMES) {
  const bg = colors[theme].find((c) => c.name === "bg");
  for (const c of colors[theme]) {
    c.contrast = contrast(c.hex, bg.hex);
    if (c.text && c.contrast < AA) {
      errors.push(
        `color.${theme}.${c.name}: ${c.contrast.toFixed(2)}:1 against bg, text roles need ≥ ${AA}:1`,
      );
    }
  }
}

const lightNames = colors.light.map((c) => c.name).join();
if (colors.dark.map((c) => c.name).join() !== lightNames) {
  errors.push("color.light and color.dark must define the same roles");
}

if (errors.length) {
  console.error(`tokens.json is invalid:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const fonts = Object.entries(tokens.font)
  .filter(([name]) => !name.startsWith("$"))
  .map(([name, token]) => ({
    name,
    stack: token.$value,
    faces: token.$extensions["no.mlz"].faces,
    description: token.$description,
  }));

const radius = `${tokens.radius.$value.value}${tokens.radius.$value.unit}`;
const ease = `cubic-bezier(${tokens.ease.$value.join(", ")})`;

// --- CSS ----------------------------------------------------------------------

const GENERIC = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
]);

// The brand face (first) is always quoted; fallbacks only when they need it.
const fontStack = (stack) =>
  stack
    .map((family, i) =>
      GENERIC.has(family) || (i > 0 && /^[A-Za-z]+$/.test(family))
        ? family
        : `"${family}"`,
    )
    .join(", ");

const oklch = ([L, C, h]) => `oklch(${L} ${C} ${h})`;

const fontFaces = (src) =>
  fonts
    .flatMap(({ stack, faces }) =>
      faces.map(
        (face) => `@font-face {
  font-family: "${stack[0]}";
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
  src: url("${src(face.file)}") format("woff2");
}`,
      ),
    )
    .join("\n");

const colorVars = (theme) =>
  colors[theme].map((c) => `  --${c.name}: ${oklch(c.components)};`).join("\n");

const themes = (extraRoot = "") => `:root {
${colorVars("light")}
${extraRoot}
  color-scheme: light;
}

[data-theme="dark"] {
${colorVars("dark")}

  color-scheme: dark;
}`;

const header = (lines) =>
  `/* GENERATED from tokens.json by scripts/brand.js — do not edit by hand.
   mlz brand v${version} · ${url("BRAND.md")}
${lines.map((l) => `   ${l}`).join("\n")} */`;

const tokensCss = `${header([
  "Font URLs are relative, so they resolve next to this file wherever it",
  "is served from: mlz.no, jsDelivr or a local checkout.",
  'Dark values apply under data-theme="dark" on <html>; see BRAND.md.',
])}

${fontFaces((file) => `fonts/${file}`)}

${themes(`
${fonts.map((f) => `  --font-${f.name}: ${fontStack(f.stack)};`).join("\n")}

  --radius: ${radius};
  --ease: ${ease};
`)}
`;

const tailwindCss = `${header([
  "Tailwind CSS v4 preset. Tailwind can't process @theme from a remote URL,",
  "so vendor this file and re-fetch it to pick up changes:",
  `  curl -o src/mlz-brand.css ${url("tailwind.css")}`,
  'then, after @import "tailwindcss": @import "./mlz-brand.css";',
  "Fonts load from mlz.no (CORS-enabled); allow it in font-src if you",
  "have a CSP.",
])}

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

${fontFaces((file) => url(`fonts/${file}`))}

${themes()}

@theme inline {
${colors.light.map((c) => `  --color-${c.name}: var(--${c.name});`).join("\n")}

${fonts.map((f) => `  --font-${f.name}: ${fontStack(f.stack)};`).join("\n")}

  --radius-brand: ${radius};
  --ease-brand: ${ease};
}
`;

// Format through the repo's Biome so the output is exactly what lint expects.
function biomeFormat(text, file) {
  const proc = Bun.spawnSync({
    cmd: [
      join(ROOT, "node_modules/.bin/biome"),
      "format",
      `--stdin-file-path=${relative(ROOT, file)}`,
    ],
    cwd: ROOT,
    stdin: Buffer.from(text),
  });
  if (proc.exitCode !== 0) {
    console.error(`biome failed on ${file}:\n${proc.stderr.toString()}`);
    process.exit(1);
  }
  return proc.stdout.toString();
}

// --- Logo SVGs ----------------------------------------------------------------

// The M is a real cut-out (evenodd), so the mark works on any background.
const MARK_PATH =
  "M7 1h18a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6Z" +
  "M7 25V7h4.5L16 18.5 20.5 7H25v18Z";
const fg = (theme) => colors[theme].find((c) => c.name === "fg").hex;

const svg = (fill, style = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <!-- GENERATED from tokens.json by scripts/brand.js — do not edit by hand. -->
  <title>mlz</title>${style}
  <path fill="${fill}" fill-rule="evenodd" d="${MARK_PATH}"/>
</svg>
`;

const logos = {
  // Follows the viewer's colour scheme (works in <img> and as a favicon).
  "logo/mark.svg": svg(
    fg("light"),
    `
  <style>@media (prefers-color-scheme: dark) { path { fill: ${fg("dark")}; } }</style>`,
  ),
  // Dark mark, for light backgrounds.
  "logo/mark-dark.svg": svg(fg("light")),
  // Light mark, for dark backgrounds.
  "logo/mark-light.svg": svg(fg("dark")),
};

// --- JSON ---------------------------------------------------------------------

// Like JSON.stringify(v, null, 2), but keeps short arrays/objects on one line.
function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v).map(
      ([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`,
    );
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(v);
}

function pretty(v, indent = "", used = 0) {
  const one = inline(v);
  if (!v || typeof v !== "object" || indent.length + used + one.length < 80) {
    return one;
  }
  const inner = `${indent}  `;
  const items = Array.isArray(v)
    ? v.map((x) => inner + pretty(x, inner))
    : Object.entries(v).map(([k, x]) => {
        const key = `${JSON.stringify(k)}: `;
        return inner + key + pretty(x, inner, key.length);
      });
  const [open, close] = Array.isArray(v) ? ["[", "]"] : ["{", "}"];
  return `${open}\n${items.join(",\n")}\n${indent}${close}`;
}

const logoFiles = (() => {
  const dir = path("logo");
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((e) =>
        e.isDirectory()
          ? walk(join(d, e.name))
          : e.name.startsWith(".")
            ? []
            : [relative(BRAND, join(d, e.name))],
      );
  return [...new Set([...walk(dir), ...Object.keys(logos)])].sort();
})();

const manifest = {
  $comment:
    "GENERATED from tokens.json by scripts/brand.js — do not edit by hand.",
  name: "mlz",
  version,
  guide: url("BRAND.md"),
  live: url(""),
  pinned,
  tokens: {
    json: url("tokens.json"),
    css: url("tokens.css"),
    tailwind: url("tailwind.css"),
  },
  colors: Object.fromEntries(
    THEMES.map((t) => [
      t,
      Object.fromEntries(colors[t].map((c) => [c.name, c.hex])),
    ]),
  ),
  fonts: Object.fromEntries(
    fonts.map((f) => [
      f.name,
      {
        family: f.stack[0],
        stack: fontStack(f.stack),
        files: f.faces.map((face) => url(`fonts/${face.file}`)),
      },
    ]),
  ),
  logo: Object.fromEntries(
    logoFiles.map((file) => [
      file.replace(/^logo\//, "").replace(/\.\w+$/, ""),
      url(file),
    ]),
  ),
};

// --- BRAND.md colour table ------------------------------------------------------

const cell = (c) => `\`${c.hex}\` · \`${oklch(c.components)}\``;
const ratio = (c) => (c.name === "bg" ? "—" : `${c.contrast.toFixed(1)}:1`);

const table = [
  "| Token | Light | Dark | Contrast on bg (light / dark) | Use |",
  "| --- | --- | --- | --- | --- |",
  ...colors.light.map((light, i) => {
    const dark = colors.dark[i];
    const aa = light.text ? " (text, ≥ 4.5 enforced)" : "";
    return `| \`--${light.name}\` | ${cell(light)} | ${cell(dark)} | ${ratio(light)} / ${ratio(dark)}${aa} | ${light.description} |`;
  }),
].join("\n");

async function withTable(file) {
  const md = await Bun.file(file).text();
  const start = "<!-- tokens:start -->";
  const end = "<!-- tokens:end -->";
  const a = md.indexOf(start);
  const b = md.indexOf(end);
  if (a === -1 || b < a) {
    console.error(`${file}: missing ${start} … ${end} markers`);
    process.exit(1);
  }
  return `${md.slice(0, a + start.length)}\n${table}\n${md.slice(b)}`;
}

// --- Write or check ---------------------------------------------------------------

const outputs = {
  "tokens.json": `${pretty(tokens)}\n`,
  "tokens.css": biomeFormat(tokensCss, path("tokens.css")),
  "tailwind.css": biomeFormat(tailwindCss, path("tailwind.css")),
  "brand.json": `${pretty(manifest)}\n`,
  "BRAND.md": await withTable(path("BRAND.md")),
  ...logos,
};

const stale = [];
for (const [file, content] of Object.entries(outputs)) {
  const target = Bun.file(path(file));
  const current = (await target.exists()) ? await target.text() : null;
  if (current === content) continue;
  stale.push(file);
  if (!check) await Bun.write(target, content);
}

if (check && stale.length) {
  console.error(
    `Out of date: ${stale.map((f) => `public/brand/${f}`).join(", ")}\nRun \`bun run brand\` and commit the result.`,
  );
  process.exit(1);
}

console.log(
  stale.length
    ? `Updated ${stale.join(", ")}`
    : `public/brand is up to date (v${version})`,
);
