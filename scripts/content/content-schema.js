/**
 * The spec for everything under content/. This is the only spec — there is
 * no separate prose copy to keep in sync, so a comment that drifts from the
 * schema next to it is caught in review, not carried for years unnoticed.
 *
 *   content/
 *     site.json              settings and copy shared by every generated page
 *     projects/<slug>.json   one case study, one tile on the overview grid
 *     figures/<name>.svg     one diagram, coloured per theme at build time
 *
 *   bun run build:content   validate, write the generated files, drop leftovers
 *   bun run check:content   validate, then fail if what's on disk differs
 *   bun run dev             serve public/ through the Firebase Hosting emulator
 *
 * build-content.js renders whatever it is handed, so without this file
 * a typo is invisible: a misspelled key is silently ignored, a block type the
 * renderer has never heard of throws halfway through a page, and a field the
 * generator stopped reading lives on in the JSON looking meaningful. This
 * module is the contract instead — every key that content/ may contain is
 * listed here, anything else is an error, and the error names the JSON path.
 *
 * Adding a field to the site is therefore two edits, in this order: describe
 * it here, then render it in build-content.js. Removing one is the same in
 * reverse — drop the renderer, drop the schema entry, and the next build
 * names which content files still carry it. A new block type is three edits:
 * a variant in the `block` union below, a renderer in build-content.js's
 * `blockRenderers`, and whatever CSS it needs in public/css/case-study.css.
 * A new tile size is a value in TILE_SIZES and a matching `.b-*` rule in
 * public/css/bento.css.
 *
 * Adding a project, start to finish:
 *   1. Pick the slug — the filename is the URL, and `slug` inside the file
 *      must match it (content/projects/event-pipeline.json → /projects/event-pipeline).
 *   2. Draw the cover figure as content/figures/<name>.svg, using {{token}}
 *      placeholders for colour — see the palette-token check further down.
 *   3. Write the file (a minimal one that builds is below), or copy an
 *      existing project and replace it section by section.
 *   4. Pick `order` — position on the overview grid, unique, and also the
 *      previous/next order at the foot of each case study.
 *   5. `bun run build:content` and fix whatever it reports.
 *   6. `bun run dev`, then look at /projects and /projects/<slug> in both
 *      themes.
 *   7. Commit content/ and the generated files under public/ together.
 *
 *   {
 *     "slug": "my-project", "order": 2, "size": "normal",
 *     "name": "My Project", "tagline": "One sentence, tile + heading.",
 *     "period": "2024 — 2025", "stack": ["Kotlin", "PostgreSQL"],
 *     "tags": ["Backend"], "status": "In production", "lastmod": "2026-09-12",
 *     "seo": { "title": "My Project — Martin Zachariassen", "description": "…" },
 *     "cover": { "figure": "my-diagram", "alt": "What the diagram shows." },
 *     "summary": "A paragraph above the first section.",
 *     "sections": [{ "label": "Problem", "heading": "…",
 *       "blocks": [{ "type": "text", "value": "A paragraph." }] }]
 *   }
 *
 * Per-field shape and type checking is Zod's job (strict objects, enums,
 * regex-validated strings). What's hand-rolled below is only the part Zod
 * can't express: checks that span multiple files — a project's slug matching
 * its filename, a figure block pointing at an SVG that exists, a palette
 * token an SVG references but public/css/tokens.css never defines.
 */

import { z } from "zod";

/* --------------------------------------------------------------- formats */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const ORIGIN = /^https:\/\/[a-z0-9.-]+$/;
const LOCALE = /^[a-z]{2}_[A-Z]{2}$/;
const PRIORITY = /^(?:0\.\d|1\.0)$/;
/** Root-relative, no trailing slash — these are concatenated, not joined. */
const SITE_PATH = /^\/[a-z0-9][a-z0-9./-]*[a-z0-9]$/;
/** Tile and link targets: off-site or a mail link, never a bare path. */
const EXTERNAL_HREF = /^(?:https?:\/\/|mailto:)\S+$/;

/**
 * A string that isn't blank, with an optional format and a friendly hint.
 * Every named pattern below already requires at least one character, so a
 * pattern makes the separate blank check redundant — without this early
 * return, a blank value fails both and reports the same field twice.
 *
 * `maxLength` is separate from `pattern`: it's for prose fields (an SEO
 * title or description) that have no fixed shape but do have a length a
 * search result truncates past, silently, with no build failure to say so.
 */
function str({ pattern, hint, allowEmpty = false, maxLength } = {}) {
  let schema = z.string();
  if (maxLength !== undefined) {
    schema = schema.max(
      maxLength,
      `search engines truncate this past ${maxLength} characters — trim it`,
    );
  }
  if (pattern) return schema.regex(pattern, hint);
  if (allowEmpty) return schema;
  return schema.refine((value) => value.trim() !== "", {
    error: "expected a non-empty string",
  });
}

/** content/ arrays are non-empty unless a call site says otherwise. */
const arr = (item, { min = 1 } = {}) => z.array(item).min(min);

const slug = str({
  pattern: SLUG,
  hint: 'expected a lowercase kebab-case slug, e.g. "event-pipeline"',
});

const date = str({
  pattern: DATE,
  hint: "expected a date as YYYY-MM-DD",
});

const sitePath = str({
  pattern: SITE_PATH,
  hint: 'expected a root-relative path with no trailing slash, e.g. "/projects"',
});

const externalHref = str({
  pattern: EXTERNAL_HREF,
  hint: "expected an http(s):// or mailto: link",
});

/**
 * Tile widths are the `.b-*` classes bento.css actually defines. A size the
 * stylesheet has no rule for renders as a full-width tile with no warning.
 */
const TILE_SIZES = ["flagship", "wide", "normal"];

/**
 * Roughly where Google truncates a result's title and snippet. Approximate
 * (it's actually pixel width, not a character count) but close enough to
 * catch the real failure mode: copy that reads fine in the JSON and gets
 * cut off with an ellipsis in search results, unnoticed until someone
 * searches for the page.
 */
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

/* ------------------------------------------------------------ site.json */

const changefreq = z.enum([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

const priority = str({
  pattern: PRIORITY,
  hint: 'expected a priority from "0.0" to "1.0", one decimal',
});

/**
 * A non-project card on the overview grid — off-site by construction, so
 * `href` must be http(s):// or mailto:, and it renders with target="_blank"
 * and a ↗. `umamiEvent` is the analytics event name; project tiles don't
 * need one, they get `project-<slug>` automatically.
 */
const asideTile = z.strictObject({
  size: z.enum(TILE_SIZES),
  label: str(),
  title: str(),
  text: str(),
  cta: str(),
  href: externalHref,
  umamiEvent: slug,
});

/**
 * content/site.json — settings and copy shared by every generated page. One
 * object, no optional keys.
 *
 * `origin`/`author`/`locale`/`umamiWebsiteId`/`ogImage` feed identity and
 * analytics (og:site_name, JSON-LD author, the analytics script tag).
 * `basePath` and `figureDir` are root-relative with no trailing slash
 * because they're concatenated rather than joined (the projects index lives
 * at `basePath`, each project at `<basePath>/<slug>`; themed SVGs are
 * written under `figureDir`). `index` is the copy on the overview page:
 * `title`/`description` go to <head> and JSON-LD, `eyebrow`/`heading`/
 * `intro` are the page copy, `asideTiles` may be `[]`.
 */
export const siteSchema = z.strictObject({
  origin: str({
    pattern: ORIGIN,
    hint: 'expected an origin like "https://mlz.no", with no trailing slash',
  }),
  author: str(),
  locale: str({ pattern: LOCALE, hint: 'expected a locale like "en_GB"' }),
  umamiWebsiteId: str({ pattern: UUID, hint: "expected a UUID" }),
  ogImage: sitePath,
  basePath: sitePath,
  figureDir: sitePath,
  // lastmod is content, not a clock reading: the sitemap is committed, so a
  // build-time `new Date()` would make every day's output differ from the
  // checked-in copy and fail check:content. Projects carry their own.
  sitemap: z.strictObject({
    home: z.strictObject({ lastmod: date, changefreq, priority }),
    index: z.strictObject({ lastmod: date, changefreq, priority }),
    project: z.strictObject({ changefreq, priority }),
  }),
  index: z.strictObject({
    title: str({ maxLength: SEO_TITLE_MAX }),
    description: str({ maxLength: SEO_DESCRIPTION_MAX }),
    eyebrow: str(),
    heading: str(),
    intro: str(),
    asideTiles: arr(asideTile, { min: 0 }),
  }),
});

/* --------------------------------------------------- content/projects/*.json */

/**
 * The body of a section. Seven types, one renderer each in build-content.js's
 * `blockRenderers`, and no way to reach a type the renderer doesn't
 * implement. Nothing in a block is parsed as Markdown or HTML — every value
 * is escaped and rendered as text, so `<`, `&` and quotes are safe to type
 * and a `**bold**` shows up as literal asterisks.
 *
 *   text     one paragraph — the block you'll use most
 *   list     `items`, optional `title`, `kind` "bulleted" (default) or "numbered"
 *   figure   `figure` is the filename under content/figures/ without ".svg"
 *   code     `language` is a label only, no syntax highlighting; `lines` is
 *            one string per line, "" for a blank line inside the snippet
 *   metrics  a row of `{ value, label }` — value is the big number
 *   quote    a pull quote, optional `attribution`
 *   note     an aside set apart from the prose, optional `title`
 */
const block = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("text"),
    value: str(),
  }),

  z.strictObject({
    type: z.literal("list"),
    title: str().optional(),
    kind: z.enum(["bulleted", "numbered"]).optional(),
    items: arr(str()),
  }),

  z.strictObject({
    type: z.literal("figure"),
    figure: slug,
    alt: str(),
    caption: str().optional(),
  }),

  z.strictObject({
    type: z.literal("code"),
    language: str(),
    caption: str().optional(),
    // Blank lines are meaningful inside a snippet, so "" is allowed here.
    lines: arr(str({ allowEmpty: true })),
  }),

  z.strictObject({
    type: z.literal("metrics"),
    items: arr(z.strictObject({ value: str(), label: str() })),
  }),

  z.strictObject({
    type: z.literal("quote"),
    value: str(),
    attribution: str().optional(),
  }),

  z.strictObject({
    type: z.literal("note"),
    title: str().optional(),
    value: str(),
  }),
]);

/**
 * content/projects/<slug>.json — one case study, one tile on the overview
 * grid. `slug` must match the filename (the URL) and `order` must be unique
 * (position on the grid, and the previous/next order at the foot of each
 * case study). `size` is a TILE_SIZES value; the stylesheet has no rule for
 * anything else, which is why the list is closed.
 *
 * What ends up where:
 *   tile         cover, period, status, name, tagline, stack
 *   case study   eyebrow (period + stack[0]), name, tagline, a facts list of
 *                role/team/status/stack, the cover figure, summary, then
 *                sections, then tags
 *   <head>       seo.title, seo.description
 *   sitemap      lastmod
 */
export const projectSchema = z.strictObject({
  slug,
  order: z.number().int().min(1),
  size: z.enum(TILE_SIZES),
  name: str(),
  tagline: str(),
  period: str(),
  role: str().optional(),
  team: str().optional(),
  stack: arr(str()),
  tags: arr(str()),
  status: str(),
  lastmod: date,
  seo: z.strictObject({
    title: str({ maxLength: SEO_TITLE_MAX }),
    description: str({ maxLength: SEO_DESCRIPTION_MAX }),
  }),
  cover: z.strictObject({
    figure: slug,
    alt: str(),
    caption: str().optional(),
  }),
  summary: str(),
  sections: arr(
    z.strictObject({
      label: str(),
      heading: str(),
      blocks: arr(block),
    }),
  ),
});

/* ---------------------------------------------------------- cross-checks */

const quote = (value) => JSON.stringify(value);

/** Collect every figure name a project points at. */
function figureRefs(project) {
  const refs = [[project.cover?.figure, "cover.figure"]];
  project.sections?.forEach((section, s) => {
    section.blocks?.forEach((entry, b) => {
      if (entry?.type === "figure") {
        refs.push([entry.figure, `sections[${s}].blocks[${b}].figure`]);
      }
    });
  });
  return refs.filter(([name]) => typeof name === "string");
}

/**
 * Checks that span files: references that must resolve, values that must be
 * unique, and output that would be generated but never used.
 */
function crossCheck({ site, projects, figures, figureFiles, tokens }, problems) {
  const add = (file, message) => problems.push({ file, message });

  // content/figures/ is read as a directory, so anything an editor or the OS
  // drops in there (a stray .DS_Store, a half-renamed .svg.bak) is otherwise
  // just silently skipped rather than flagged — the same way an unreferenced
  // .svg is flagged below, not ignored.
  for (const name of figureFiles) {
    if (!name.endsWith(".svg")) {
      add(
        `content/figures/${name}`,
        "not a .svg file — content/figures/ holds only figure sources",
      );
    }
  }

  const knownTokens = new Set(Object.keys(tokens?.light ?? {}));
  const referenced = new Set();

  for (const [name, source] of figures) {
    const file = `content/figures/${name}.svg`;
    if (!/viewBox="0 0 \d+ \d+"/.test(source)) {
      add(
        file,
        'needs a viewBox="0 0 W H" to size the <img> it is loaded into',
      );
    }
    const used = new Set(
      [...source.matchAll(/\{\{(\w+)\}\}/g)].map(([, token]) => token),
    );
    for (const token of used) {
      if (!knownTokens.has(token)) {
        add(file, `unknown palette token {{${token}}}`);
      }
    }
  }

  const seen = { slug: new Map(), order: new Map() };
  for (const { file, data } of projects) {
    const expected = file.replace(/^.*\//, "").replace(/\.json$/, "");
    if (typeof data.slug === "string" && data.slug !== expected) {
      add(
        file,
        `slug: ${quote(data.slug)} does not match the filename — the page is written to /projects/${expected}`,
      );
    }

    for (const key of ["slug", "order"]) {
      const value = data[key];
      if (value === undefined) continue;
      const owner = seen[key].get(value);
      if (owner) {
        add(file, `${key}: ${quote(value)} is already used by ${owner}`);
      } else {
        seen[key].set(value, file);
      }
    }

    for (const [name, path] of figureRefs(data)) {
      referenced.add(name);
      if (!figures.has(name)) {
        add(file, `${path}: no content/figures/${name}.svg`);
      }
    }
  }

  // Every figure is rendered to a -light and a -dark file under public/, so an
  // unreferenced one is two committed files nothing links to.
  for (const name of figures.keys()) {
    if (!referenced.has(name)) {
      add(`content/figures/${name}.svg`, "not referenced by any project");
    }
  }
}

/* ------------------------------------------------------------- entry point */

export class ContentError extends Error {}

/** Turns a Zod issue path like ["sections", 0, "blocks"] into "sections[0].blocks". */
function formatPath(path) {
  return path.reduce((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return acc ? `${acc}.${segment}` : `${segment}`;
  }, "");
}

/**
 * Most issues carry their own message directly, but a few Zod issue types
 * (a bad record key, among others) wrap the real failure in a nested
 * `issues` array with its own path *relative to the wrapper*. Recursing
 * finds the actual message instead of the wrapper's generic one, e.g.
 * "Invalid key in record".
 */
function* flattenIssues(issues, prefix = []) {
  for (const issue of issues) {
    const path = [...prefix, ...issue.path];
    if (issue.issues?.length) {
      yield* flattenIssues(issue.issues, path);
    } else {
      yield { path, message: issue.message };
    }
  }
}

function collect(file, schema, value, problems) {
  const result = schema.safeParse(value);
  if (result.success) return;
  for (const { path, message } of flattenIssues(result.error.issues)) {
    problems.push({
      file,
      message: `${formatPath(path) || "(root)"}: ${message}`,
    });
  }
}

/**
 * Validates everything in one pass and throws once, so a broken file reports
 * all of its problems instead of one per run.
 *
 * @param {object} input
 * @param {object} input.site         parsed content/site.json
 * @param {{file: string, data: object}[]} input.projects
 * @param {Map<string, string>} input.figures  name -> raw SVG source, .svg files only
 * @param {string[]} input.figureFiles every filename in content/figures/, unfiltered
 * @param {{light: object, dark: object}} input.tokens palette tokens parsed from public/css/tokens.css
 */
export function validateContent({
  site,
  projects,
  figures,
  figureFiles,
  tokens,
}) {
  const problems = [];

  collect("content/site.json", siteSchema, site, problems);
  for (const { file, data } of projects) {
    collect(file, projectSchema, data, problems);
  }
  crossCheck({ site, projects, figures, figureFiles, tokens }, problems);

  if (!problems.length) return;

  const byFile = new Map();
  for (const { file, message } of problems) {
    byFile.set(file, [...(byFile.get(file) ?? []), message]);
  }
  const detail = [...byFile]
    .map(([file, messages]) =>
      [file, ...messages.map((message) => `  ${message}`)].join("\n"),
    )
    .join("\n\n");

  throw new ContentError(
    `${problems.length} problem${problems.length === 1 ? "" : "s"} in content/ — see scripts/content/content-schema.js for the spec\n\n${detail}`,
  );
}
