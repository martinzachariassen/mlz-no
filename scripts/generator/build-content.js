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
 * This file owns the filesystem: it reads content/, drives the renderer, and
 * writes or compares the result. The rest of the generator is beside it:
 *
 *   content-schema.js   the spec every file under content/ is checked against
 *   render.js           content in, finished page strings out — no fs
 *   html.js             the template engine those renderers are written with
 *   tokens.js           the palette, parsed out of public/css/tokens.css
 *   check-links.js      every link the output emits resolves to a real file
 *   paths.js            content/ and public/, resolved once
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
import { checkAssetLinks } from "./check-links.js";
import { ContentError, validateContent } from "./content-schema.js";
import { contentDir, publicDir, rel } from "./paths.js";
import { createRenderer } from "./render.js";
import { readTokens } from "./tokens.js";

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ContentError(`${rel(path)}: ${error.message}`);
  }
};

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

/**
 * The regions every page in CHROME_PAGES carries, and what to call the
 * renderer with for a given page. `theme-color` takes no per-page argument —
 * it is here because it is a literal copy of a tokens.css colour, and the
 * point of generating it is that there is nowhere left to hand-write one.
 */
const chromeBlocks = (renderer, page) => ({
  topbar: renderer.topbar(page.topbar),
  footer: renderer.footer(page.footer),
  "theme-color": renderer.themeColor(),
});

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
export function spliceChrome(source, blocks, file) {
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
        chromeBlocks(renderer, page),
        rel(path),
      ),
    };
  });
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
export function findStrays(outputs, site) {
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

  const brokenLinks = checkAssetLinks(outputs, site, new Set(strays));
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
