/**
 * Every page, figure and sitemap entry the site generates, as one pure
 * function of the validated content.
 *
 * Nothing here reads or writes a file: `createRenderer` is handed the parsed
 * content and returns the finished strings, which is what lets render.test.js
 * exercise all of it against fixtures without a public/ directory to compare
 * against. build-content.js owns the filesystem and calls into this.
 *
 * Everything passed in has already been checked against content-schema.js, so
 * no renderer below re-checks a field: if it got this far it has the shape the
 * spec describes. A new field has to be described there first.
 *
 * Nothing here emits inline <style>, inline <script> or onclick attributes —
 * firebase.json's CSP has no 'unsafe-inline', so generated markup has the same
 * constraints as the hand-written pages.
 */

import { tileClasses } from "./bento.js";
import { projectEventName } from "./content-schema.js";
import { esc, html, raw, unraw } from "./html.js";

/**
 * The one place a rendered tree becomes a finished text file: the RAW_NEWLINE
 * markers that protect a code block's line breaks turn back into newlines, and
 * the file gets its trailing one. Every page and the sitemap go through here,
 * so a new kind of page can't ship those markers by forgetting a call — which
 * is what had happened to the old sitemap(), harmlessly only because a sitemap
 * contains no code blocks.
 */
const textFile = (path, text) => ({ path, content: `${unraw(text)}\n` });

/** The same unwrapping for a fragment that is spliced, not written whole. */
const output = (text) => unraw(text);

/**
 * JSON-LD is embedded in a <script> element, and it is the HTML parser, not
 * the JSON parser, that decides where that element ends: the byte sequence
 * `</script` closes it regardless of the JSON string it sits inside. A project
 * whose name or summary contained one would therefore not be escaped into
 * harmless text the way the page body escapes it — it would end the block
 * early and hand the rest of the value to the parser as markup.
 *
 * Escaping the three characters that can start such a sequence as JSON's own
 * `\uXXXX` leaves the value byte-for-byte identical once parsed, so consumers
 * see exactly the content/ copy, while the sequence can never appear in the
 * file at all.
 */
const jsonLdScript = (data) =>
  JSON.stringify(data, null, 2).replace(
    /[<>&]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

export function createRenderer({ site, projects: unordered, figures, tokens }) {
  /**
   * `order` is unique and required, so this is a total ordering — and it is
   * applied here rather than by the caller because the renderers are what
   * depend on it: the overview grid's sequence, the sitemap's, and the
   * previous/next cards at the foot of each case study are all "the next
   * project by order", which is only true if the array is sorted.
   */
  const projects = [...unordered].sort((a, b) => a.order - b.order);

  const projectUrl = (project) => `${site.basePath}/${project.slug}`;

  /**
   * The status most of the projects share, or null if there is no such thing.
   *
   * Every tile carrying "In production" is eight badges that distinguish
   * nothing: the reader learns the same fact eight times and has no way to
   * tell it was ever in question. The tiles drop the common one and keep the
   * exception, which is the only version that carries information — and it
   * self-adjusts, so the day half the work is archived the badge starts
   * meaning something again without an edit here. The case study's facts list
   * states it either way; that is a table you look things up in.
   *
   * Two projects at minimum, so a site with one project still shows its
   * status rather than deciding a sample of one is a convention.
   */
  const routineStatus = (() => {
    const counts = new Map();
    for (const { status } of projects) {
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    for (const [status, count] of counts) {
      if (count >= 2 && count * 2 > projects.length) return status;
    }
    return null;
  })();

  /* -------------------------------------------------------- reading time */

  const WORDS_PER_MINUTE = 200;

  const words = (value) => value.trim().split(/\s+/).length;

  /**
   * How much of a block is prose, by block type — the same one-entry-per-type
   * table as `blockRenderers` below, and it has to stay that way: a new block
   * type without an entry here throws at build time instead of quietly
   * shortening every estimate that contains one.
   *
   * A figure, a code listing and a row of metrics count as nothing. They take
   * a reader time, but not reading time, and guessing at how much would make
   * the number less honest rather than more.
   */
  const blockWords = {
    text: (block) => words(block.value),
    list: (block) =>
      block.items.reduce((total, item) => total + words(item), 0),
    figure: () => 0,
    code: () => 0,
    metrics: () => 0,
    quote: (block) => words(block.value),
    note: (block) => words(block.value),
  };

  /** Rounded up from nothing to one: no page is a zero-minute read. */
  function readingMinutes(project) {
    let total = words(project.summary);
    for (const section of project.sections) {
      total += words(section.heading);
      for (const block of section.blocks) {
        total += blockWords[block.type](block);
      }
    }
    return Math.max(1, Math.round(total / WORDS_PER_MINUTE));
  }

  /**
   * The id each section is reachable at, derived from its label rather than
   * authored — content/ says nothing about anchors and shouldn't have to. Two
   * sections sharing a label get `-2`, `-3`: an index whose links quietly all
   * point at the first of them would be worse than an ugly id.
   */
  function sectionAnchors(sections) {
    const used = new Set();
    return sections.map((section, i) => {
      const base =
        section.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `section-${i + 1}`;
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      return id;
    });
  }

  /* ------------------------------------------------------------- figures */

  /**
   * One SVG source per figure, rendered once per theme. The pages swap between
   * the two files in CSS, because an SVG loaded through <img> is its own
   * document and cannot see the page's custom properties or [data-theme].
   */
  function figureAssets() {
    const files = [];
    for (const [name, figure] of figures) {
      for (const theme of ["light", "dark"]) {
        const palette = tokens[theme];
        files.push({
          path: `${site.figureDir}/${name}-${theme}.svg`,
          content: figure.source.replace(
            /\{\{(\w+)\}\}/g,
            (_, token) => palette[token],
          ),
        });
      }
    }
    return files;
  }

  /**
   * `frame` wraps the pair in a scroll container and makes each copy a link to
   * its own SVG. These are wide diagrams: at phone width they would shrink to
   * an unreadable strip, so a case study lets them keep a legible minimum
   * width and scroll sideways instead — and the link is the way out of that
   * box, since the file opened on its own is the only place a dense diagram
   * can be as large as the reader's screen allows.
   *
   * The link has to be per theme rather than around the pair: the two files
   * are different documents and only CSS knows which one is on screen, so the
   * theme class goes on the link as well and case-study.css hides the pair the
   * reader isn't looking at. A tile's figure is unframed for the same reason
   * it can't be a link — the whole tile already is one.
   */
  function figureImages(name, alt, { eager = false, frame = false } = {}) {
    const figure = figures.get(name);
    const loading = eager ? "eager" : "lazy";
    const shared = `alt="${esc(alt)}" width="${figure.width}" height="${figure.height}" loading="${loading}" decoding="async"`;
    const src = (theme) => `${site.figureDir}/${name}-${theme}.svg`;
    const image = (theme) => html`
      <img class="shot shot-${theme}" src="${src(theme)}"
        ${shared} />`;
    if (!frame) {
      return html`
        ${image("light")}
        ${image("dark")}`;
    }
    const linked = (theme) => html`
      <a class="shot-link shot-${theme}" href="${src(theme)}"
        target="_blank" rel="noopener" title="Open the full-size diagram">
        ${image(theme)}
      </a>`;
    return html`
      <span class="shot-frame">
        ${linked("light")}
        ${linked("dark")}
      </span>`;
  }

  /* ------------------------------------------------------------ partials */

  /**
   * The browser-chrome colour, as a literal value per theme. It cannot be a
   * var(--bg) reference — this is a <meta> tag, not CSS — so it is the third
   * place on the site that would otherwise carry a hand-written copy of the
   * palette, after site.webmanifest and favicon.svg (both pinned by a test in
   * build-content.test.js, because neither is generated). This one *is*
   * generated: pages built here get it from head() below, and the two
   * hand-written pages have it spliced into a `<!-- generated:theme-color -->`
   * region, so tokens.css stays the only place the colour is written down.
   */
  function themeColor() {
    return output(html`
      <meta
        name="theme-color"
        media="(prefers-color-scheme: light)"
        content="${tokens.light.bg}"
      />
      <meta
        name="theme-color"
        media="(prefers-color-scheme: dark)"
        content="${tokens.dark.bg}"
      />`);
  }

  function head({ title, description, canonical, styles }) {
    const url = `${site.origin}${canonical}`;
    return html`
      <meta charset="UTF-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, viewport-fit=cover"
      />
      <meta name="color-scheme" content="light dark" />
      <script src="/theme-init.js"></script>
      <meta name="format-detection" content="telephone=no" />
      <title>${esc(title)}</title>
      <meta
        name="description"
        content="${esc(description)}"
      />
      <link rel="canonical" href="${esc(url)}" />
      <link rel="icon" type="image/svg+xml" href="/assets/icons/favicon.svg" />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/assets/icons/favicon-32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="192x192"
        href="/assets/icons/favicon-192.png"
      />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/assets/icons/apple-touch-icon.png"
      />
      <link rel="manifest" href="/assets/site.webmanifest" />
      ${themeColor()}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="${esc(site.author)}" />
      <meta property="og:url" content="${esc(url)}" />
      <meta property="og:title" content="${esc(title)}" />
      <meta
        property="og:description"
        content="${esc(description)}"
      />
      <meta property="og:locale" content="${esc(site.locale)}" />
      <meta property="og:image" content="${site.origin}${site.ogImage}" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta
        property="og:image:alt"
        content="${esc(site.author)} — Senior Software Developer"
      />
      <meta name="twitter:card" content="summary_large_image" />
      ${styles.map((name) => `<link rel="stylesheet" href="/css/${name}" />`)}
      <script
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id="${site.umamiWebsiteId}"
      ></script>`;
  }

  /**
   * The shared chrome. Generated pages embed it; public/index.html and
   * public/404.html have it spliced into a `<!-- generated:topbar -->` region
   * by build-content.js, so the three copies cannot drift — they are one
   * function with one argument.
   *
   * `current` is the only thing that varies: "page" on the projects overview
   * (the link points at the page you're on), "section" on a case study (you're
   * under /projects but not at it), and null on the home and 404 pages.
   */
  function topbar({ current = null } = {}) {
    const active = current ? " active" : "";
    const ariaCurrent = current === "page" ? ' aria-current="page"' : "";
    return output(html`
      <header class="wrap topbar rise delay-50">
        <a href="/" aria-label="MLZ home" class="brand">
          <svg
            class="brand-mark"
            width="16"
            height="16"
            viewBox="0 0 32 32"
            fill="none"
            role="img"
            aria-label="MLZ"
          >
            <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--fg)" />
            <polygon
              points="7,25 7,7 11.5,7 16,18.5 20.5,7 25,7 25,25"
              fill="var(--bg)"
            />
          </svg>
          <span class="brand-word" data-glitch>mlz<span class="period">.</span></span>
        </a>
        <div class="topbar-right">
          <a class="nav-link${active}" href="${site.basePath}"${ariaCurrent} data-umami-event="nav-projects" data-glitch>Projects</a>
          <button
            type="button"
            class="theme-toggle"
            data-theme-toggle
            aria-label="Toggle colour theme"
          >
            <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>
        </div>
      </header>`);
  }

  /**
   * The footer and the scripts that follow it — one region, because they are
   * always adjacent and always last in the body. `delay` is the motion.css
   * class that staggers the footer's entrance behind the page content above
   * it, and it's the only thing that differs between pages.
   */
  function footer({ delay = "delay-750" } = {}) {
    return output(html`
      <footer class="rise ${delay}">
        <div class="wrap footer-row">
          <span data-glitch>© <span data-year>2026</span> · ${esc(site.author)}</span>
          <span data-glitch>59°N · 10°E</span>
        </div>
      </footer>
      <script src="/js/theme-toggle.js" defer></script>
      <script src="/js/year.js" defer></script>
      <script src="/js/glitch.js" defer></script>`);
  }

  function page({ meta, jsonLd, body, current }) {
    return html`
      <!doctype html>
      <html lang="en">
        <head>
          ${head(meta)}
          ${
            jsonLd
              ? html`
                <script type="application/ld+json">
                  ${jsonLdScript(jsonLd)}
                </script>`
              : ""
          }
        </head>
        <body>
          ${topbar({ current })}
          ${body}
          ${footer()}
        </body>
      </html>`;
  }

  /* ------------------------------------------------------- page: index */

  /**
   * A tile's shape comes from where it sits, not from anything in content/:
   * bento.js cuts the run into bands that fill the grid and hands back the
   * class that carries the result. Everything that varies with it (the cover
   * figure, the stack line, the type scale) is a rule on that class in
   * public/css/bento.css, not a branch here — the same tile is a different
   * shape at each breakpoint, and only CSS knows which one is in force.
   *
   * `first` is the one tile whose figure is worth blocking on — it is the
   * largest thing above the fold at every width, so it is eager where the
   * rest are lazy.
   */
  function bentoTile(project, className, first) {
    return html`
      <a class="b-tile ${className}" href="${projectUrl(project)}"
        data-umami-event="${esc(projectEventName(project.slug))}">
        <span class="b-media">
          ${figureImages(project.cover.figure, project.cover.alt, { eager: first })}
        </span>
        <span class="b-body">
          <span class="b-meta">
            <span data-glitch>${esc(project.period)}</span>
            ${
              project.status === routineStatus
                ? ""
                : html`<span class="b-status">${esc(project.status)}</span>`
            }
          </span>
          <span class="b-title">${esc(project.name)}</span>
          <span class="b-tagline">${esc(project.tagline)}</span>
          <span class="b-stack">${esc(project.stack.join(" · "))}</span>
          <span class="b-cta"><span data-glitch>Read case study</span><span class="b-arrow" aria-hidden="true">→</span></span>
        </span>
      </a>`;
  }

  function asideTile(tile, className) {
    const external = tile.href.startsWith("http");
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return html`
      <a class="b-tile b-aside ${className}" href="${esc(tile.href)}"${rel}
        data-umami-event="${esc(tile.umamiEvent)}">
        <span class="b-body">
          <span class="b-label" data-glitch>${esc(tile.label)}</span>
          <span class="b-title">${esc(tile.title)}</span>
          <span class="b-tagline">${esc(tile.text)}</span>
          <span class="b-cta"><span data-glitch>${esc(tile.cta)}</span><span class="b-arrow" aria-hidden="true">↗</span></span>
        </span>
      </a>`;
  }

  function indexPage() {
    const config = site.index;
    // Projects and aside tiles are one run through the layout, in the order
    // they are rendered — an aside tile is a tile on the same grid, and the
    // band it shares with a project has to add up like any other.
    const classes = tileClasses(projects.length + config.asideTiles.length);
    return page({
      current: "page",
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
      body: html`
        <main class="wrap page">
          <header class="page-head rise delay-150">
            <p class="page-eyebrow"><span data-glitch>${esc(config.eyebrow)}</span></p>
            <h1 class="page-title">${esc(config.heading)}</h1>
            <p class="page-intro">${esc(config.intro)}</p>
          </header>
          <section class="bento" aria-label="Projects">
            ${projects.map((project, i) => bentoTile(project, classes[i], i === 0))}
            ${config.asideTiles.map((tile, i) => asideTile(tile, classes[projects.length + i]))}
          </section>
        </main>`,
    });
  }

  /* -------------------------------------------------- page: case study */

  /**
   * The row of numbers, rendered the same way wherever it appears: a project's
   * `outcome` in the brief at the top of the page, and a `metrics` block
   * inside a section. `className` is the only difference, and it only says
   * which of the two this is.
   */
  const metricsList = (items, className = "metrics") => html`
    <dl class="${className}">
      ${items.map(
        (item) => html`
          <div class="metric">
            <dt>${esc(item.label)}</dt>
            <dd>${esc(item.value)}</dd>
          </div>`,
      )}
    </dl>`;

  const blockRenderers = {
    text: (block) => html`<p class="prose">${esc(block.value)}</p>`,

    list: (block) => {
      const tag = block.kind === "numbered" ? "ol" : "ul";
      return html`
        ${block.title ? `<p class="block-title" data-glitch>${esc(block.title)}</p>` : ""}
        <${tag} class="prose-list">
          ${block.items.map((item) => `<li>${esc(item)}</li>`)}
        </${tag}>`;
    },

    figure: (block) => html`
      <figure class="figure">
        ${figureImages(block.figure, block.alt, { frame: true })}
        ${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}
      </figure>`,

    code: (block) => html`
      <figure class="code">
        <figcaption class="code-head">
          <span class="code-lang" data-glitch>${esc(block.language)}</span>
          ${block.caption ? `<span>${esc(block.caption)}</span>` : ""}
        </figcaption>
        <pre tabindex="0"><code>${raw(block.lines.map((line) => esc(line)).join("\n"))}</code></pre>
      </figure>`,

    metrics: (block) => metricsList(block.items),

    quote: (block) => html`
      <blockquote class="pull">
        <p>${esc(block.value)}</p>
        ${block.attribution ? `<cite>${esc(block.attribution)}</cite>` : ""}
      </blockquote>`,

    note: (block) => html`
      <aside class="note">
        ${block.title ? `<p class="note-title" data-glitch>${esc(block.title)}</p>` : ""}
        <p>${esc(block.value)}</p>
      </aside>`,
  };

  /** One renderer per block type in the spec — the spec rejects any other. */
  const renderBlock = (block) => blockRenderers[block.type](block);

  function endNav(index) {
    const previous = projects[index - 1];
    const next = projects[index + 1];
    /**
     * `tagline` is what makes these a choice rather than two names: this row
     * is the only place the next project is offered, and a reader who has
     * just finished one case study has no other way to tell whether the next
     * one is worth the scroll.
     */
    const card = (cls, label, title, href, tagline) => html`
      <a class="end-card${cls}" href="${href}">
        <span class="end-label" data-glitch>${esc(label)}</span>
        <span class="end-title">${esc(title)}</span>
        ${tagline ? `<span class="end-tagline">${esc(tagline)}</span>` : ""}
      </a>`;

    const indexCard = (cls) =>
      card(cls, "Index", "All projects", site.basePath);

    // Each side of the row always gets a card: the real previous/next project
    // where one exists, otherwise the Index card fills that side instead —
    // left-aligned on the left, right-aligned (" end-next") on the right. A
    // project with neither gets a single Index card, left-aligned, alone.
    const cards = [];
    if (previous) {
      cards.push(
        card(
          "",
          "← Previous",
          previous.name,
          projectUrl(previous),
          previous.tagline,
        ),
      );
    } else if (next) {
      cards.push(indexCard(""));
    }
    if (next) {
      cards.push(
        card(" end-next", "Next →", next.name, projectUrl(next), next.tagline),
      );
    } else if (previous) {
      cards.push(indexCard(" end-next"));
    }
    if (!previous && !next) {
      cards.push(indexCard(""));
    }

    return html`
      <nav class="end-nav wrap" aria-label="More projects">
        ${cards}
      </nav>`;
  }

  function casePage(project, index) {
    const facts = [
      ["Role", project.role],
      ["Team", project.team],
      ["Status", project.status],
      ["Stack", project.stack.join(" · ")],
    ].filter(([, value]) => value);

    const anchors = sectionAnchors(project.sections);

    /**
     * Below three sections there is nothing to orient yourself in: the index
     * would be a list of everything already visible, which is chrome that
     * looks like navigation and saves nobody a scroll.
     */
    const caseIndex =
      project.sections.length < 3
        ? ""
        : html`
          <nav class="case-index" aria-label="Sections">
            <span class="case-index-label" data-glitch>On this page</span>
            ${project.sections.map(
              (section, i) =>
                html`<a href="#${anchors[i]}">${esc(section.label)}</a>`,
            )}
          </nav>`;

    return page({
      current: "section",
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
      body: html`
        <main class="wrap page">
          <header class="page-head rise delay-150">
            <p class="page-eyebrow">
              <span data-glitch>${esc(project.period)}</span>
              <span class="sep" aria-hidden="true">/</span>
              <span data-glitch>${readingMinutes(project)} min read</span>
            </p>
            <h1 class="page-title">${esc(project.name)}</h1>
            <p class="page-intro">${esc(project.tagline)}</p>
          </header>
          <div class="case-brief rise delay-450">
            <dl class="case-facts">
              ${facts.map(
                ([label, value]) => html`
                  <div class="fact">
                    <dt data-glitch>${esc(label)}</dt>
                    <dd>${esc(value)}</dd>
                  </div>`,
              )}
            </dl>
            ${project.outcome ? metricsList(project.outcome, "metrics case-outcome") : ""}
            ${caseIndex}
          </div>
          <p class="case-summary rise delay-550">${esc(project.summary)}</p>
          <figure class="figure figure-cover rise delay-600">
            ${figureImages(project.cover.figure, project.cover.alt, { eager: true, frame: true })}
            ${project.cover.caption ? `<figcaption>${esc(project.cover.caption)}</figcaption>` : ""}
          </figure>
          ${project.sections.map(
            (section, i) => html`
              <section class="field" id="${anchors[i]}">
                <p class="field-label" data-glitch>${esc(section.label)}</p>
                <h2 class="field-heading">${esc(section.heading)}</h2>
                ${section.blocks.map(renderBlock)}
              </section>`,
          )}
          <div class="case-topics">
            <p class="block-title" data-glitch>Topics</p>
            <ul class="tag-list">
              ${project.tags.map((tag) => `<li>${esc(tag)}</li>`)}
            </ul>
          </div>
        </main>
        ${endNav(index)}`,
    });
  }

  /* ----------------------------------------------------------- sitemap */

  /**
   * Every date here comes from content/, never from the clock: this file is
   * committed, and a build-time `new Date()` would put the build out of date
   * with itself the following day.
   */
  function sitemap() {
    const entry = ({ loc, lastmod, changefreq, priority }) => html`
      <url>
        <loc>${loc}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${changefreq}</changefreq>
        <priority>${priority}</priority>
      </url>`;

    return html`
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${entry({ loc: `${site.origin}/`, ...site.sitemap.home })}
        ${entry({ loc: `${site.origin}${site.basePath}`, ...site.sitemap.index })}
        ${projects.map((project) =>
          entry({
            loc: `${site.origin}${projectUrl(project)}`,
            lastmod: project.lastmod,
            ...site.sitemap.project,
          }),
        )}
      </urlset>`;
  }

  /* ------------------------------------------------------------ outputs */

  return {
    /** The shared chrome, for splicing into the hand-written pages. */
    topbar,
    footer,
    themeColor,

    /**
     * Every file generated from content/, at paths relative to public/.
     * Figures are passed through byte-for-byte (an SVG source carries its own
     * trailing newline); pages and the sitemap are finished by `textFile`.
     */
    files: () => [
      ...figureAssets(),
      textFile(`${site.basePath}/index.html`, indexPage()),
      ...projects.map((project, index) =>
        textFile(
          `${site.basePath}/${project.slug}.html`,
          casePage(project, index),
        ),
      ),
      textFile("/sitemap.xml", sitemap()),
    ],
  };
}
