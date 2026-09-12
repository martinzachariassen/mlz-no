#!/usr/bin/env bun
/**
 * Generates the projects section from content/ into public/.
 *
 * The site itself still has no build step: public/ is deployed exactly as it
 * sits on disk, and everything this script writes is committed. The script
 * only exists so the prose for a project lives in one place instead of being
 * duplicated across the bento tile, the case study, the <head> tags and the
 * sitemap.
 *
 *   bun run build:content    write the generated files
 *   bun run check:content    fail if what's on disk differs (used by CI)
 *
 * Nothing here emits inline <style>, inline <script> or onclick attributes —
 * firebase.json's CSP has no 'unsafe-inline', so generated markup has the
 * same constraints as the hand-written pages.
 *
 * Everything read from content/ is checked against scripts/content-schema.js
 * before a single page is rendered, so the renderers below can assume the
 * shape they were written for. A new field has to be described there first.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError, validateContent } from "./content-schema.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content");
const publicDir = join(root, "public");

const check = process.argv.includes("--check");

/* ------------------------------------------------------------------ util */

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Escape a value for use in HTML text or a double-quoted attribute. */
const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ESCAPES[c]);

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ContentError(`${path.slice(root.length + 1)}: ${error.message}`);
  }
};

/** Drop empty lines so template holes don't leave ragged blank runs. */
const lines = (...parts) => parts.flat().filter(Boolean).join("\n");

/* --------------------------------------------------------------- content */

/**
 * Read content/ and hand it to the spec before anything is rendered. Nothing
 * below this point re-checks a field: if it got past validateContent it has
 * the shape scripts/content-schema.js describes.
 */
function loadContent() {
  const site = readJson(join(contentDir, "site.json"));

  const files = readdirSync(join(contentDir, "projects"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({
      file: `content/projects/${name}`,
      data: readJson(join(contentDir, "projects", name)),
    }));

  const figureDir = join(contentDir, "figures");
  const sources = new Map(
    readdirSync(figureDir)
      .filter((name) => name.endsWith(".svg"))
      .map((name) => [
        name.replace(/\.svg$/, ""),
        readFileSync(join(figureDir, name), "utf8"),
      ]),
  );

  validateContent({ site, projects: files, figures: sources });

  return {
    site,
    // `order` is unique and required, so this is a total ordering.
    projects: files.map(({ data }) => data).sort((a, b) => a.order - b.order),
    figures: new Map(
      [...sources].map(([name, source]) => {
        const [, width, height] = source.match(/viewBox="0 0 (\d+) (\d+)"/);
        return [name, { source, width, height }];
      }),
    ),
  };
}

let content;
try {
  content = loadContent();
} catch (error) {
  if (!(error instanceof ContentError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const { site, projects, figures } = content;

const projectUrl = (project) => `${site.basePath}/${project.slug}`;

/* --------------------------------------------------------------- figures */

/**
 * One SVG source per figure, rendered once per theme. The pages swap between
 * the two files in CSS, because an SVG loaded through <img> is its own
 * document and cannot see the page's custom properties or [data-theme].
 */
function renderFigureAssets() {
  const files = new Map();
  for (const [name, figure] of figures) {
    for (const theme of ["light", "dark"]) {
      const palette = site.palette[theme];
      const svg = figure.source.replace(
        /\{\{(\w+)\}\}/g,
        (_, token) => palette[token],
      );
      files.set(join(publicDir, site.figureDir, `${name}-${theme}.svg`), svg);
    }
  }
  return files;
}

/**
 * `frame` wraps the pair in a scroll container. These are wide diagrams: at
 * phone width they would shrink to an unreadable strip, so a case study lets
 * them keep a legible minimum width and scroll sideways instead.
 */
function figureImages(name, alt, { eager = false, frame = false } = {}) {
  const figure = figures.get(name);
  const loading = eager ? "eager" : "lazy";
  const shared =
    `alt="${esc(alt)}" width="${figure.width}" height="${figure.height}"` +
    ` loading="${loading}" decoding="async"`;
  const pad = frame ? "  " : "";
  const images = lines(
    `${pad}<img class="shot shot-light" src="${site.figureDir}/${name}-light.svg"`,
    `${pad}  ${shared} />`,
    `${pad}<img class="shot shot-dark" src="${site.figureDir}/${name}-dark.svg"`,
    `${pad}  ${shared} />`,
  );
  if (!frame) return images;
  return lines('<span class="shot-frame">', images, "</span>");
}

/* --------------------------------------------------------------- partials */

function head({ title, description, canonical, styles }) {
  const url = `${site.origin}${canonical}`;
  return lines(
    '    <meta charset="UTF-8" />',
    "    <meta",
    '      name="viewport"',
    '      content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
    "    />",
    '    <meta name="color-scheme" content="light dark" />',
    '    <script src="/theme-init.js"></script>',
    '    <meta name="format-detection" content="telephone=no" />',
    `    <title>${esc(title)}</title>`,
    "    <meta",
    '      name="description"',
    `      content="${esc(description)}"`,
    "    />",
    `    <link rel="canonical" href="${esc(url)}" />`,
    "",
    '    <link rel="icon" type="image/svg+xml" href="/assets/icons/favicon.svg" />',
    "    <link",
    '      rel="icon"',
    '      type="image/png"',
    '      sizes="32x32"',
    '      href="/assets/icons/favicon-32.png"',
    "    />",
    "    <link",
    '      rel="icon"',
    '      type="image/png"',
    '      sizes="192x192"',
    '      href="/assets/icons/favicon-192.png"',
    "    />",
    '    <link rel="shortcut icon" href="/favicon.ico" />',
    "    <link",
    '      rel="apple-touch-icon"',
    '      sizes="180x180"',
    '      href="/assets/icons/apple-touch-icon.png"',
    "    />",
    '    <link rel="manifest" href="/assets/site.webmanifest" />',
    "    <meta",
    '      name="theme-color"',
    '      media="(prefers-color-scheme: light)"',
    `      content="${site.palette.light.bg}"`,
    "    />",
    "    <meta",
    '      name="theme-color"',
    '      media="(prefers-color-scheme: dark)"',
    `      content="${site.palette.dark.bg}"`,
    "    />",
    "",
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:site_name" content="${esc(site.author)}" />`,
    `    <meta property="og:url" content="${esc(url)}" />`,
    `    <meta property="og:title" content="${esc(title)}" />`,
    "    <meta",
    '      property="og:description"',
    `      content="${esc(description)}"`,
    "    />",
    `    <meta property="og:locale" content="${esc(site.locale)}" />`,
    `    <meta property="og:image" content="${site.origin}${site.ogImage}" />`,
    '    <meta property="og:image:type" content="image/png" />',
    '    <meta property="og:image:width" content="1200" />',
    '    <meta property="og:image:height" content="630" />',
    "    <meta",
    '      property="og:image:alt"',
    `      content="${esc(site.author)} — Senior Software Developer"`,
    "    />",
    '    <meta name="twitter:card" content="summary_large_image" />',
    "",
    styles.map((name) => `    <link rel="stylesheet" href="/css/${name}" />`),
    "",
    "    <script",
    "      defer",
    '      src="https://cloud.umami.is/script.js"',
    `      data-website-id="${site.umamiWebsiteId}"`,
    "    ></script>",
  );
}

/**
 * Copied verbatim into every page, exactly as 404.html already copies it from
 * index.html — there are no partials without a template engine, and the two
 * hand-written pages carry the same block.
 */
function topbar({ exact }) {
  const current = exact ? ' aria-current="page"' : "";
  return lines(
    '    <header class="wrap topbar rise delay-50">',
    '      <a href="/" aria-label="MLZ home" class="brand">',
    "        <svg",
    '          class="brand-mark"',
    '          width="16"',
    '          height="16"',
    '          viewBox="0 0 32 32"',
    '          fill="none"',
    '          role="img"',
    '          aria-label="MLZ"',
    "        >",
    '          <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--fg)" />',
    "          <polygon",
    '            points="7,25 7,7 11.5,7 16,18.5 20.5,7 25,7 25,25"',
    '            fill="var(--bg)"',
    "          />",
    "        </svg>",
    '        <span class="brand-word" data-glitch>mlz<span class="period">.</span></span>',
    "      </a>",
    "",
    '      <div class="topbar-right">',
    `        <a class="nav-link active" href="${site.basePath}"${current} data-umami-event="nav-projects" data-glitch>Projects</a>`,
    "        <button",
    '          type="button"',
    '          class="theme-toggle"',
    "          data-theme-toggle",
    '          aria-label="Toggle colour theme"',
    "        >",
    '          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '            <circle cx="12" cy="12" r="4" />',
    '            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />',
    "          </svg>",
    '          <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />',
    "          </svg>",
    "        </button>",
    "      </div>",
    "    </header>",
  );
}

function footer() {
  return lines(
    '    <footer class="rise delay-750">',
    '      <div class="wrap footer-row">',
    "        <span data-glitch>© <span data-year>2026</span> · Martin Zachariassen</span>",
    "        <span data-glitch>59°N · 10°E</span>",
    "      </div>",
    "    </footer>",
    "",
    '    <script src="/js/theme-toggle.js" defer></script>',
    '    <script src="/js/year.js" defer></script>',
    '    <script src="/js/glitch.js" defer></script>',
  );
}

function page({ meta, jsonLd, body, exact = false }) {
  return `${lines(
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    head(meta),
    jsonLd
      ? lines(
          "",
          '    <script type="application/ld+json">',
          JSON.stringify(jsonLd, null, 2)
            .split("\n")
            .map((line) => `      ${line}`),
          "    </script>",
        )
      : "",
    "  </head>",
    "  <body>",
    topbar({ exact }),
    "",
    body,
    "",
    footer(),
    "  </body>",
    "</html>",
  )}\n`;
}

/* ------------------------------------------------------------ page: index */

function bentoTile(project) {
  return lines(
    `      <a class="b-tile b-${esc(project.size)}" href="${projectUrl(project)}"`,
    `        data-umami-event="project-${esc(project.slug)}">`,
    '        <span class="b-media">',
    figureImages(project.cover.figure, project.cover.alt, { eager: true })
      .split("\n")
      .map((line) => `          ${line}`),
    "        </span>",
    '        <span class="b-body">',
    '          <span class="b-meta">',
    `            <span data-glitch>${esc(project.period)}</span>`,
    `            <span class="b-status">${esc(project.status)}</span>`,
    "          </span>",
    `          <span class="b-title">${esc(project.name)}</span>`,
    `          <span class="b-tagline">${esc(project.tagline)}</span>`,
    `          <span class="b-stack">${esc(project.stack.join(" · "))}</span>`,
    '          <span class="b-cta"><span data-glitch>Read case study</span><span class="b-arrow" aria-hidden="true">→</span></span>',
    "        </span>",
    "      </a>",
  );
}

function asideTile(tile) {
  const external = tile.href.startsWith("http");
  const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return lines(
    `      <a class="b-tile b-${esc(tile.size)} b-aside" href="${esc(tile.href)}"${rel}`,
    `        data-umami-event="${esc(tile.umamiEvent)}">`,
    '        <span class="b-body">',
    `          <span class="b-label" data-glitch>${esc(tile.label)}</span>`,
    `          <span class="b-title">${esc(tile.title)}</span>`,
    `          <span class="b-tagline">${esc(tile.text)}</span>`,
    `          <span class="b-cta"><span data-glitch>${esc(tile.cta)}</span><span class="b-arrow" aria-hidden="true">↗</span></span>`,
    "        </span>",
    "      </a>",
  );
}

function indexPage() {
  const config = site.index;
  return page({
    exact: true,
    meta: {
      title: config.title,
      description: config.description,
      canonical: site.basePath,
      styles: [
        "tokens.css",
        "base.css",
        "topbar.css",
        "page-head.css",
        "bento.css",
        "footer.css",
        "motion.css",
      ],
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: config.heading,
      url: `${site.origin}${site.basePath}`,
      description: config.description,
      hasPart: projects.map((project) => ({
        "@type": "CreativeWork",
        name: project.name,
        url: `${site.origin}${projectUrl(project)}`,
        abstract: project.tagline,
      })),
    },
    body: lines(
      '    <main class="wrap page">',
      '      <header class="page-head rise delay-150">',
      `        <p class="page-eyebrow"><span data-glitch>${esc(config.eyebrow)}</span></p>`,
      `        <h1 class="page-title">${esc(config.heading)}</h1>`,
      `        <p class="page-intro">${esc(config.intro)}</p>`,
      "      </header>",
      "",
      '      <section class="bento" aria-label="Projects">',
      projects.map(bentoTile),
      config.asideTiles.map(asideTile),
      "      </section>",
      "    </main>",
    ),
  });
}

/* ------------------------------------------------------- page: case study */

const blockRenderers = {
  text: (block) => `        <p class="prose">${esc(block.value)}</p>`,

  list: (block) => {
    const tag = block.kind === "numbered" ? "ol" : "ul";
    return lines(
      block.title
        ? `        <p class="block-title" data-glitch>${esc(block.title)}</p>`
        : "",
      `        <${tag} class="prose-list">`,
      block.items.map((item) => `          <li>${esc(item)}</li>`),
      `        </${tag}>`,
    );
  },

  figure: (block) =>
    lines(
      '        <figure class="figure">',
      figureImages(block.figure, block.alt, { frame: true })
        .split("\n")
        .map((line) => `          ${line}`),
      block.caption
        ? `          <figcaption>${esc(block.caption)}</figcaption>`
        : "",
      "        </figure>",
    ),

  code: (block) =>
    lines(
      '        <figure class="code">',
      '          <figcaption class="code-head">',
      `            <span class="code-lang" data-glitch>${esc(block.language)}</span>`,
      block.caption ? `            <span>${esc(block.caption)}</span>` : "",
      "          </figcaption>",
      `          <pre tabindex="0"><code>${block.lines
        .map((line) => esc(line))
        .join("\n")}</code></pre>`,
      "        </figure>",
    ),

  metrics: (block) =>
    lines(
      '        <dl class="metrics">',
      block.items.flatMap((item) => [
        '          <div class="metric">',
        `            <dt>${esc(item.label)}</dt>`,
        `            <dd>${esc(item.value)}</dd>`,
        "          </div>",
      ]),
      "        </dl>",
    ),

  quote: (block) =>
    lines(
      '        <blockquote class="pull">',
      `          <p>${esc(block.value)}</p>`,
      block.attribution
        ? `          <cite>${esc(block.attribution)}</cite>`
        : "",
      "        </blockquote>",
    ),

  note: (block) =>
    lines(
      '        <aside class="note">',
      block.title
        ? `          <p class="note-title" data-glitch>${esc(block.title)}</p>`
        : "",
      `          <p>${esc(block.value)}</p>`,
      "        </aside>",
    ),
};

/** One renderer per block type in the spec — the spec rejects any other. */
const renderBlock = (block) => blockRenderers[block.type](block);

function endNav(index) {
  const previous = projects[index - 1];
  const next = projects[index + 1];
  const card = (cls, label, title, href) =>
    lines(
      `      <a class="end-card${cls}" href="${href}">`,
      `        <span class="end-label" data-glitch>${esc(label)}</span>`,
      `        <span class="end-title">${esc(title)}</span>`,
      "      </a>",
    );

  const cards = [];
  if (previous) {
    cards.push(card("", "← Previous", previous.name, projectUrl(previous)));
  }
  if (next) {
    cards.push(card(" end-next", "Next →", next.name, projectUrl(next)));
  }
  // With a single project there is no previous or next, so the row falls back
  // to one card back to the overview — left-aligned when it stands alone,
  // since there is nothing to its left for it to point away from.
  if (cards.length < 2) {
    const cls = cards.length ? " end-next" : "";
    cards.push(card(cls, "Index", "All projects", site.basePath));
  }

  return lines(
    '    <nav class="end-nav wrap" aria-label="More projects">',
    cards,
    "    </nav>",
  );
}

function casePage(project, index) {
  const facts = [
    ["Role", project.role],
    ["Team", project.team],
    ["Status", project.status],
    ["Stack", project.stack.join(" · ")],
  ].filter(([, value]) => value);

  return page({
    meta: {
      title: project.seo.title,
      description: project.seo.description,
      canonical: projectUrl(project),
      styles: [
        "tokens.css",
        "base.css",
        "topbar.css",
        "page-head.css",
        "case-study.css",
        "bento.css",
        "footer.css",
        "motion.css",
      ],
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: project.name,
      url: `${site.origin}${projectUrl(project)}`,
      abstract: project.tagline,
      description: project.summary,
      author: { "@type": "Person", name: site.author, url: site.origin },
      keywords: project.tags.join(", "),
      isPartOf: {
        "@type": "CollectionPage",
        name: site.index.heading,
        url: `${site.origin}${site.basePath}`,
      },
    },
    body: lines(
      '    <main class="wrap page case">',
      '      <header class="page-head rise delay-150">',
      '        <p class="page-eyebrow">',
      `          <span data-glitch>${esc(project.period)}</span>`,
      '          <span class="sep" aria-hidden="true">/</span>',
      `          <span data-glitch>${esc(project.stack[0])}</span>`,
      "        </p>",
      `        <h1 class="page-title">${esc(project.name)}</h1>`,
      `        <p class="page-intro">${esc(project.tagline)}</p>`,
      "      </header>",
      "",
      '      <dl class="case-facts rise delay-450">',
      facts.flatMap(([label, value]) => [
        '        <div class="fact">',
        `          <dt data-glitch>${esc(label)}</dt>`,
        `          <dd>${esc(value)}</dd>`,
        "        </div>",
      ]),
      "      </dl>",
      "",
      '      <figure class="figure figure-cover rise delay-600">',
      figureImages(project.cover.figure, project.cover.alt, {
        eager: true,
        frame: true,
      })
        .split("\n")
        .map((line) => `        ${line}`),
      project.cover.caption
        ? `        <figcaption>${esc(project.cover.caption)}</figcaption>`
        : "",
      "      </figure>",
      "",
      `      <p class="case-summary">${esc(project.summary)}</p>`,
      "",
      project.sections.map((section) =>
        lines(
          '      <section class="field">',
          `        <p class="field-label" data-glitch>${esc(section.label)}</p>`,
          `        <h2 class="field-heading">${esc(section.heading)}</h2>`,
          section.blocks.map(renderBlock),
          "      </section>",
        ),
      ),
      "",
      '      <ul class="tag-list" aria-label="Topics">',
      project.tags.map((tag) => `        <li>${esc(tag)}</li>`),
      "      </ul>",
      "    </main>",
      "",
      endNav(index),
    ),
  });
}

/* ------------------------------------------------------------ sitemap.xml */

/**
 * Every date here comes from content/, never from the clock: this file is
 * committed, and a build-time `new Date()` would put the build out of date
 * with itself the following day.
 */
function sitemap() {
  const entry = ({ loc, lastmod, changefreq, priority }) =>
    lines(
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    );

  return `${lines(
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entry({ loc: `${site.origin}/`, ...site.sitemap.home }),
    entry({ loc: `${site.origin}${site.basePath}`, ...site.sitemap.index }),
    projects.map((project) =>
      entry({
        loc: `${site.origin}${projectUrl(project)}`,
        lastmod: project.lastmod,
        ...site.sitemap.project,
      }),
    ),
    "</urlset>",
  )}\n`;
}

/* ------------------------------------------------------------------ write */

const outputs = new Map([
  ...renderFigureAssets(),
  [join(publicDir, "projects", "index.html"), indexPage()],
  ...projects.map((project, index) => [
    join(publicDir, "projects", `${project.slug}.html`),
    casePage(project, index),
  ]),
  [join(publicDir, "sitemap.xml"), sitemap()],
]);

if (check) {
  const stale = [...outputs].filter(
    ([path, content]) =>
      !existsSync(path) || readFileSync(path, "utf8") !== content,
  );
  if (stale.length) {
    console.error(
      "Generated files are out of date. Run: bun run build:content",
    );
    for (const [path] of stale)
      console.error(`  ${path.slice(root.length + 1)}`);
    process.exit(1);
  }
  console.log(`content up to date (${outputs.size} files)`);
} else {
  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`wrote ${path.slice(root.length + 1)}`);
  }
}
