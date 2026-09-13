#!/usr/bin/env bun
/**
 * Generates the projects section from content/ into public/.
 *
 * The site itself still has no build step: public/ is deployed exactly as it
 * sits on disk, and everything this script writes is committed. The script
 * only exists so the prose for a project lives in one place instead of being
 * duplicated across the bento tile, the case study, the <head> tags and the
 * sitemap — and so the topbar and footer live in one place instead of being
 * copied into every page by hand.
 *
 *   bun run build:content    write the generated files, remove leftovers
 *   bun run check:content    fail if what's on disk differs (used by CI)
 *
 * This file owns the filesystem and nothing else:
 *
 *   content-schema.js   the spec every file under content/ is checked against
 *   render.js           content in, finished page strings out — no fs
 *   html.js             the template engine those renderers are written with
 *
 * Everything read from content/ is checked against the spec before a single
 * page is rendered, so the renderers can assume the shape they were written
 * for. A new field has to be described there first.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError, validateContent } from "./content-schema.js";
import { createRenderer } from "./render.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const contentDir = join(root, "content");
export const publicDir = join(root, "public");

const rel = (path) => path.slice(root.length + 1);

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ContentError(`${rel(path)}: ${error.message}`);
  }
};

/* ---------------------------------------------------------------- palette */

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
 * out of public/css/tokens.css, so the figures (which can't see the page's
 * own CSS — see render.js's figureAssets) are always painted with the same
 * colours as the page itself, instead of a hand-maintained copy that can
 * drift. Dark values that aren't overridden inherit from light, the same way
 * the real cascade works.
 */
function readTokens() {
  const path = join(publicDir, "css", "tokens.css");
  const css = readFileSync(path, "utf8");

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

/* ---------------------------------------------------------------- content */

/**
 * Read content/ and hand it to the spec before anything is rendered. Nothing
 * downstream re-checks a field: if it got past validateContent it has the
 * shape content-schema.js describes.
 */
function loadContent() {
  const site = readJson(join(contentDir, "site.json"));
  const tokens = readTokens();

  const files = readdirSync(join(contentDir, "projects"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({
      file: `content/projects/${name}`,
      data: readJson(join(contentDir, "projects", name)),
    }));

  const figureDir = join(contentDir, "figures");
  const figureFiles = readdirSync(figureDir);
  const sources = new Map(
    figureFiles
      .filter((name) => name.endsWith(".svg"))
      .map((name) => [
        name.replace(/\.svg$/, ""),
        readFileSync(join(figureDir, name), "utf8"),
      ]),
  );

  validateContent({
    site,
    projects: files,
    figures: sources,
    figureFiles,
    tokens,
  });

  return {
    site,
    tokens,
    // Deliberately unsorted: render.js sorts by `order`, because it is the
    // renderers that depend on the sequence. Sorting here as well would just
    // mean two places to get it right.
    projects: files.map(({ data }) => data),
    figures: new Map(
      [...sources].map(([name, source]) => {
        const [, width, height] = source.match(/viewBox="0 0 (\d+) (\d+)"/);
        return [name, { source, width, height }];
      }),
    ),
  };
}

/* ----------------------------------------------------------- page chrome */

/**
 * public/index.html and public/404.html are hand-written — they have their own
 * hero, their own copy, and no reason to live in content/. But they carry the
 * same topbar and footer as every generated page, and that markup used to be
 * three copies kept in sync by hand, which is the duplication most likely to
 * actually drift: prose gets proofread, markup doesn't.
 *
 * So the two pages keep their body and the generator owns those two blocks,
 * spliced into `<!-- generated:name -->` regions. `check:content` compares the
 * result byte-for-byte like any other output, so an edit inside a region fails
 * CI instead of silently diverging from the generated pages.
 *
 * Each entry is the argument the shared renderer is called with — the whole
 * difference between one page's chrome and another's.
 */
const CHROME_PAGES = [
  {
    path: "/index.html",
    topbar: { current: null },
    footer: { delay: "delay-750" },
  },
  {
    path: "/404.html",
    topbar: { current: null },
    footer: { delay: "delay-850" },
  },
];

const REGION =
  /^([ \t]*)<!-- generated:([\w-]+) -->\n[\s\S]*?^[ \t]*<!-- \/generated:\2 -->$/gm;

/**
 * Replaces the body of every `<!-- generated:name -->` region with the block
 * of the same name, re-indented to the marker's own column.
 *
 * Both directions are an error: a region naming a block that doesn't exist is
 * a typo that would otherwise be left untouched and look generated, and a
 * block with no region means that page silently stopped receiving updates to
 * markup it still displays.
 */
function spliceChrome(source, blocks, file) {
  const seen = new Set();

  const out = source.replace(REGION, (_match, indent, name) => {
    const block = blocks[name];
    if (block === undefined) {
      throw new ContentError(
        `${file}: <!-- generated:${name} --> names no known block (have: ${Object.keys(blocks).join(", ")})`,
      );
    }
    seen.add(name);
    const body = block
      .split("\n")
      .map((line) => (line === "" ? line : indent + line))
      .join("\n");
    return `${indent}<!-- generated:${name} -->\n${body}\n${indent}<!-- /generated:${name} -->`;
  });

  const missing = Object.keys(blocks).filter((name) => !seen.has(name));
  if (missing.length) {
    throw new ContentError(
      `${file}: no <!-- generated:${missing[0]} --> ... <!-- /generated:${missing[0]} --> region — the shared ${missing[0]} cannot be kept in sync`,
    );
  }
  return out;
}

/** The hand-written pages, with their shared chrome refreshed. */
function chromeFiles(renderer) {
  return CHROME_PAGES.map((page) => {
    const path = join(publicDir, page.path);
    return {
      path: page.path,
      content: spliceChrome(
        readFileSync(path, "utf8"),
        {
          topbar: renderer.topbar(page.topbar),
          footer: renderer.footer(page.footer),
        },
        rel(path),
      ),
    };
  });
}

/* ------------------------------------------------------------ asset links */

/**
 * Every root-relative href/src/og:image the written pages emit must resolve to
 * a real file — either something this run writes (a figure, a case study page)
 * or something already on disk (a stylesheet, an icon). This isn't a content/
 * check: a broken link is just as likely to come from a typo in render.js's
 * own hardcoded <head>/<script> markup, which content-schema.js never sees, as
 * from content/site.json's ogImage.
 */
const STATIC_EXTENSION = /\.[a-z0-9]+$/i;
const REFERENCE =
  /\s(?:href|src)="([^"]+)"|<loc>([^<]+)<\/loc>|property="og:image"\s+content="([^"]+)"/g;

export function checkAssetLinks(outputs, site) {
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
    const has = (candidate) => outputs.has(candidate) || existsSync(candidate);
    if (STATIC_EXTENSION.test(path)) return has(target);
    return has(`${target}.html`) || has(join(target, "index.html"));
  };

  const broken = [];
  for (const [path, source] of outputs) {
    if (!/\.(?:html|xml)$/.test(path)) continue;
    for (const match of source.matchAll(REFERENCE)) {
      const ref = match[1] ?? match[2] ?? match[3];
      const local = localAssetPath(ref);
      if (local !== null && !resolvesToFile(local)) {
        broken.push(`${rel(path)}: broken link to ${ref}`);
      }
    }
  }
  return broken;
}

/* ------------------------------------------------------------------ write */

/**
 * Directories under public/ that belong entirely to this script: everything in
 * them comes out of `outputs`, so a file that isn't in it is a leftover. The
 * usual way to get one is renaming a project, which leaves the old case study
 * on disk and therefore live at its old URL, missing from both the sitemap and
 * the overview grid. Comparing only the expected paths can't see that, so the
 * managed directories are listed rather than inferred. A generated file that
 * sits among hand-written ones (public/sitemap.xml, and the two pages whose
 * chrome is spliced) can't be told apart by path, so its directory isn't
 * listed and it is only ever overwritten.
 */
function findStrays(outputs, site) {
  return [join(publicDir, site.basePath), join(publicDir, site.figureDir)]
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name)),
    )
    .filter((path) => !outputs.has(path))
    .sort();
}

function main() {
  const check = process.argv.includes("--check");
  const { site, projects, figures, tokens } = loadContent();
  const renderer = createRenderer({ site, projects, figures, tokens });

  const outputs = new Map(
    [...renderer.files(), ...chromeFiles(renderer)].map(({ path, content }) => [
      join(publicDir, path),
      content,
    ]),
  );
  const strays = findStrays(outputs, site);

  const brokenLinks = checkAssetLinks(outputs, site);
  if (brokenLinks.length) {
    console.error("Generated pages link to files that don't exist:");
    for (const line of brokenLinks) console.error(`  ${line}`);
    process.exit(1);
  }

  if (check) {
    const stale = [...outputs]
      .filter(
        ([path, content]) =>
          !existsSync(path) || readFileSync(path, "utf8") !== content,
      )
      .map(([path]) => rel(path));

    if (stale.length || strays.length) {
      console.error(
        "Generated files are out of date. Run: bun run build:content",
      );
      for (const path of stale) console.error(`  ${path}`);
      for (const path of strays) {
        console.error(
          `  ${rel(path)} — not generated from content/, would be removed`,
        );
      }
      process.exit(1);
    }
    console.log(`content up to date (${outputs.size} files)`);
    return;
  }

  for (const path of strays) {
    rmSync(path);
    console.log(`removed ${rel(path)}`);
  }
  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`wrote ${rel(path)}`);
  }
}

try {
  if (import.meta.main) main();
} catch (error) {
  if (!(error instanceof ContentError)) throw error;
  console.error(error.message);
  process.exit(1);
}
