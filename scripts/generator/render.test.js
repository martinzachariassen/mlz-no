import { describe, expect, test } from "bun:test";
import { createRenderer } from "./render.js";

/**
 * render.js turns validated content into the exact bytes that get committed
 * and served, and it is the half of the generator with no other safety net:
 * content-schema.js checks the input, `check:content` checks that the output
 * on disk matches the output in memory, but neither has an opinion about
 * whether that output is right.
 *
 * These fixtures are the smallest content that reaches every renderer — one
 * project exercising all seven block types plus both optional facts, and one
 * aside tile. Each test asserts one property of the result rather than a whole
 * page, so a deliberate copy change doesn't fail a test that was really about
 * escaping or indentation.
 */

const site = {
  origin: "https://example.com",
  author: "Test Author",
  locale: "en_GB",
  umamiWebsiteId: "12345678-1234-1234-1234-123456789012",
  ogImage: "/og.png",
  basePath: "/projects",
  figureDir: "/assets/figures",
  sitemap: {
    home: { lastmod: "2026-01-01", changefreq: "weekly", priority: "1.0" },
    index: { lastmod: "2026-01-02", changefreq: "weekly", priority: "0.9" },
    project: { changefreq: "monthly", priority: "0.8" },
  },
  index: {
    title: "Projects",
    description: "Selected work.",
    eyebrow: "Work",
    heading: "Selected work",
    intro: "A short intro.",
    asideTiles: [
      {
        label: "Elsewhere",
        title: "GitHub",
        text: "Code I have published.",
        cta: "Browse",
        href: "https://github.com/example",
        umamiEvent: "aside-github",
      },
    ],
  },
  caseEnd: {
    text: "Questions about any of this?",
    cta: "Email me",
    href: "mailto:hi@example.com",
    umamiEvent: "case-contact",
  },
};

/** One project carrying every block type and both optional facts. */
const project = {
  slug: "demo",
  order: 1,
  name: "Demo",
  tagline: "A demo project.",
  period: "2026",
  role: "Lead",
  team: "Four engineers",
  stack: ["Kotlin", "PostgreSQL"],
  tags: ["Backend", "Data"],
  status: "In production",
  lastmod: "2026-01-03",
  seo: { title: "Demo — Test", description: "A demo project for tests." },
  cover: { figure: "diagram", alt: "A diagram", caption: "The system." },
  summary: "What this project is.",
  sections: [
    {
      label: "Problem",
      heading: "The problem",
      blocks: [
        { type: "text", value: "A paragraph." },
        {
          type: "list",
          title: "Steps",
          kind: "numbered",
          items: ["One", "Two"],
        },
        { type: "list", items: ["Bullet"] },
        {
          type: "figure",
          figure: "diagram",
          alt: "Same diagram",
          caption: "Fig.",
        },
        {
          type: "code",
          language: "kotlin",
          caption: "The hot loop",
          lines: ["fun main() {", "", "  println(1)", "}"],
        },
        { type: "metrics", items: [{ value: "12k", label: "Events/s" }] },
        { type: "quote", value: "It worked.", attribution: "A colleague" },
        { type: "note", title: "Caveat", value: "Numbers are approximate." },
      ],
    },
  ],
};

const figures = new Map([
  [
    "diagram",
    {
      source: '<svg viewBox="0 0 100 50"><rect fill="{{bg}}" /></svg>\n',
      width: "100",
      height: "50",
    },
  ],
]);

const tokens = {
  light: { bg: "oklch(0.95 0 0)" },
  dark: { bg: "oklch(0.2 0 0)" },
};

/** A renderer over the fixtures, with `projects` overridable per test. */
const renderer = (projects = [project]) =>
  createRenderer({ site, projects, figures, tokens });

/** The generated files keyed by path, the way build-content.js writes them. */
const filesOf = (projects) =>
  new Map(
    renderer(projects)
      .files()
      .map((f) => [f.path, f.content]),
  );

const allFiles = filesOf();
const indexPage = allFiles.get("/projects/index.html");
const casePage = allFiles.get("/projects/demo.html");
const sitemap = allFiles.get("/sitemap.xml");

describe("generated files", () => {
  test("writes a page per project, an overview, a sitemap and both themes of each figure", () => {
    expect([...allFiles.keys()].sort()).toEqual([
      "/assets/figures/diagram-dark.svg",
      "/assets/figures/diagram-light.svg",
      "/projects/demo.html",
      "/projects/index.html",
      "/sitemap.xml",
    ]);
  });

  /**
   * html.js hides a code block's real newlines behind a private character
   * while pages are composed. A file that still contains one — or the hole
   * separator — means some renderer skipped the one place that unwraps them.
   */
  test("no output still carries html.js's private sentinel characters", () => {
    for (const [path, content] of allFiles) {
      expect(`${path}: ${content.includes("\u0000")}`).toBe(`${path}: false`);
      expect(`${path}: ${content.includes("\u0001")}`).toBe(`${path}: false`);
    }
  });

  test("every text file ends with exactly one newline", () => {
    for (const path of [
      "/projects/index.html",
      "/projects/demo.html",
      "/sitemap.xml",
    ]) {
      expect(`${path}: ${/[^\n]\n$/.test(allFiles.get(path))}`).toBe(
        `${path}: true`,
      );
    }
  });

  test("no page has a trailing-whitespace or blank-line gap left by an omitted field", () => {
    for (const path of ["/projects/index.html", "/projects/demo.html"]) {
      expect(`${path}: ${/[ \t]+\n/.test(allFiles.get(path))}`).toBe(
        `${path}: false`,
      );
    }
  });
});

describe("figures", () => {
  test("substitutes the palette of each theme into one shared source", () => {
    expect(allFiles.get("/assets/figures/diagram-light.svg")).toBe(
      '<svg viewBox="0 0 100 50"><rect fill="oklch(0.95 0 0)" /></svg>\n',
    );
    expect(allFiles.get("/assets/figures/diagram-dark.svg")).toBe(
      '<svg viewBox="0 0 100 50"><rect fill="oklch(0.2 0 0)" /></svg>\n',
    );
  });

  test("emits both themed <img> tags with the viewBox dimensions", () => {
    expect(casePage).toContain(
      '<img class="shot shot-light" src="/assets/figures/diagram-light.svg"',
    );
    expect(casePage).toContain(
      '<img class="shot shot-dark" src="/assets/figures/diagram-dark.svg"',
    );
    expect(casePage).toContain('width="100" height="50"');
  });
});

describe("topbar", () => {
  const nav = (current) =>
    renderer()
      .topbar(current)
      .split("\n")
      .find((line) => line.includes("nav-link"))
      .trim();

  test("marks the link current on the page it points at", () => {
    expect(nav({ current: "page" })).toContain('class="nav-link active"');
    expect(nav({ current: "page" })).toContain('aria-current="page"');
  });

  test("marks the section active on a case study, but not as the current page", () => {
    expect(nav({ current: "section" })).toContain('class="nav-link active"');
    expect(nav({ current: "section" })).not.toContain("aria-current");
  });

  test("leaves the link inert elsewhere, which is the hand-written pages' state", () => {
    expect(nav({ current: null })).toContain('class="nav-link"');
    expect(nav({ current: null })).not.toContain("aria-current");
    expect(nav()).toBe(nav({ current: null }));
  });

  /**
   * The point of the whole splicing arrangement: the block build-content.js
   * drops into public/index.html is the same block a generated page embeds,
   * differing only by the indentation the splice adds. Re-indenting here the
   * way spliceChrome does is what makes that comparable.
   */
  test("is the same block a generated page embeds, modulo indentation", () => {
    const embedded = (block) =>
      block
        .split("\n")
        .map((line) => (line === "" ? line : `    ${line}`))
        .join("\n");
    expect(indexPage).toContain(
      embedded(renderer().topbar({ current: "page" })),
    );
    expect(casePage).toContain(
      embedded(renderer().topbar({ current: "section" })),
    );
    expect(indexPage).toContain(embedded(renderer().footer()));
  });
});

describe("footer", () => {
  test("takes its stagger class from the page it belongs to", () => {
    expect(renderer().footer({ delay: "delay-850" })).toContain(
      '<footer class="rise delay-850">',
    );
    expect(renderer().footer()).toContain('<footer class="rise delay-750">');
  });

  test("carries the shared scripts, so a page cannot get one without the others", () => {
    const block = renderer().footer();
    expect(block).toContain('src="/js/theme-toggle.js"');
    expect(block).toContain('src="/js/year.js"');
    expect(block).toContain('src="/js/glitch.js"');
  });

  test("takes the name from site.author, not a hardcoded copy", () => {
    const customSite = { ...site, author: "Someone Else" };
    const block = createRenderer({
      site: customSite,
      projects: [project],
      figures,
      tokens,
    }).footer();
    expect(block).toContain("Someone Else");
  });
});

describe("case study blocks", () => {
  test("renders every block type in the spec", () => {
    expect(casePage).toContain('<p class="prose">A paragraph.</p>');
    expect(casePage).toContain('<ol class="prose-list">');
    expect(casePage).toContain('<ul class="prose-list">');
    expect(casePage).toContain(
      '<h3 class="block-title" data-glitch>Steps</h3>',
    );
    expect(casePage).toContain('<span class="figure-note">Fig.</span>');
    expect(casePage).toContain(
      '<span class="code-lang" data-glitch>kotlin</span>',
    );
    expect(casePage).toContain('<dl class="metrics">');
    expect(casePage).toContain('<blockquote class="pull">');
    expect(casePage).toContain("<cite>A colleague</cite>");
    expect(casePage).toContain('<aside class="note">');
  });

  /**
   * The end-to-end half of html.test.js's raw() test: by the time a code block
   * reaches a written file it has been embedded three levels deep, and its
   * lines still have to start at column zero.
   */
  test("keeps a code block's lines flush and its blank lines intact", () => {
    expect(casePage).toContain(
      '<pre tabindex="0"><code>fun main() {\n\n  println(1)\n}</code></pre>',
    );
  });

  test("renders an optional block field only when present", () => {
    expect(casePage).toContain(
      '<h3 class="note-title" data-glitch>Caveat</h3>',
    );
    const bare = filesOf([
      {
        ...project,
        sections: [
          {
            label: "L",
            heading: "H",
            blocks: [{ type: "note", value: "No title." }],
          },
        ],
      },
    ]).get("/projects/demo.html");
    expect(bare).not.toContain("note-title");
    expect(bare).toMatch(/<aside class="note">\n\s+<p>No title\.<\/p>/);
  });
});

describe("case study page", () => {
  test("lists the optional facts when the project has them", () => {
    expect(casePage).toContain("<dd>Lead</dd>");
    expect(casePage).toContain("<dd>Four engineers</dd>");
    expect(casePage).toContain("<dd>Kotlin · PostgreSQL</dd>");
  });

  test("omits a fact the project leaves out, with no empty row", () => {
    const { role, team, ...withoutFacts } = project;
    const page = filesOf([withoutFacts]).get("/projects/demo.html");
    expect(page).toContain("<dd>In production</dd>");
    expect(page).not.toContain("<dt data-glitch>Role</dt>");
    expect(page).not.toContain("<dd></dd>");
  });

  test("describes the page to search engines from seo, not from the tile copy", () => {
    expect(casePage).toContain("<title>Demo — Test</title>");
    expect(casePage).toContain('content="A demo project for tests."');
    expect(casePage).toContain(
      '<link rel="canonical" href="https://example.com/projects/demo" />',
    );
  });

  test("emits JSON-LD that points back at the overview page", () => {
    const json = JSON.parse(
      casePage.match(
        /<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/,
      )[1],
    );
    expect(json["@type"]).toBe("CreativeWork");
    expect(json.url).toBe("https://example.com/projects/demo");
    expect(json.keywords).toBe("Backend, Data");
    expect(json.isPartOf.url).toBe("https://example.com/projects");
  });

  /** From content/, like the sitemap's copy of it — never from the clock. */
  test("dates the page from the project's own lastmod", () => {
    expect(casePage).toContain('"dateModified": "2026-01-03"');
    expect(sitemap).toContain("<lastmod>2026-01-03</lastmod>");
  });
});

/**
 * Everything above the first section: the summary, the facts, the headline
 * numbers and the index of what's below. The order of these is the whole point
 * — a reader who never scrolls past the first screen should still have the
 * result — so the tests assert position, not just presence.
 */
describe("the brief", () => {
  const positions = (page, ...needles) =>
    needles.map((needle) => page.indexOf(needle));

  const ordered = (page, ...needles) => {
    const found = positions(page, ...needles);
    expect(found.every((at) => at !== -1)).toBe(true);
    return found.every((at, i) => i === 0 || found[i - 1] < at);
  };

  /**
   * The outcome numbers used to come first, so "1 of 17" and "6 ms → 0" met a
   * reader who had been told nothing yet and could not mean anything to them.
   * They are still above the fold; they are just no longer above the sentence
   * that explains them.
   */
  test("renders the summary before the outcome numbers it explains", () => {
    const page = filesOf([
      {
        ...project,
        outcome: [
          { value: "7h → 1.2s", label: "Freshness" },
          { value: "0", label: "Incidents" },
        ],
      },
    ]).get("/projects/demo.html");
    expect(page).toContain('<dl class="metrics case-outcome">');
    expect(page).toContain("<dd>7h → 1.2s</dd>");
    expect(ordered(page, "case-summary", "case-brief", "case-outcome")).toBe(
      true,
    );
  });

  test("leaves the row out of a project that has no outcome", () => {
    expect(casePage).not.toContain("case-outcome");
    expect(casePage).toContain('<div class="case-brief rise delay-550">');
  });

  /**
   * The cover figure used to come first, so the page opened with a dense
   * diagram of a system the reader had not yet been told anything about.
   */
  test("puts the summary before the cover figure", () => {
    expect(ordered(casePage, "case-summary", "figure-cover")).toBe(true);
  });

  test("counts the page's own prose into a reading time in the eyebrow", () => {
    expect(casePage).toContain("<span data-glitch>1 min read</span>");
    const long = filesOf([
      {
        ...project,
        sections: [
          {
            label: "Problem",
            heading: "The problem",
            blocks: [{ type: "text", value: "word ".repeat(400).trim() }],
          },
        ],
      },
    ]).get("/projects/demo.html");
    expect(long).toContain("<span data-glitch>2 min read</span>");
  });

  /**
   * The eyebrow used to repeat stack[0], which the facts list states in full
   * three lines further down.
   */
  test("does not repeat the stack in the eyebrow", () => {
    const eyebrow = casePage.match(
      /<p class="page-eyebrow">([\s\S]*?)<\/p>/,
    )[1];
    expect(eyebrow).toContain("2026");
    expect(eyebrow).not.toContain("Kotlin");
  });
});

describe("section index", () => {
  const sectioned = (...labels) => ({
    ...project,
    sections: labels.map((label) => ({
      label,
      heading: `${label} heading`,
      blocks: [{ type: "text", value: "A paragraph." }],
    })),
  });

  const pageFor = (...labels) =>
    filesOf([sectioned(...labels)]).get("/projects/demo.html");

  test("links every section, at the id that section carries", () => {
    const page = pageFor("Problem", "Approach", "Result");
    expect(page).toContain(
      '<nav class="case-index rise delay-550" aria-label="Sections">',
    );
    expect(page).toContain('<a href="#problem">Problem</a>');
    expect(page).toContain(
      '<section class="field" id="problem" tabindex="-1">',
    );
    expect(page).toContain('<a href="#approach">Approach</a>');
    expect(page).toContain('<section class="field" id="result" tabindex="-1">');
  });

  /**
   * The rail it becomes from 1080px is a grid item of .case-page, so it has to
   * be a child of it — inside .case-brief, where it used to live, it could not
   * be placed in the second column at all.
   */
  test("sits beside the brief, not inside it", () => {
    const page = pageFor("Problem", "Approach", "Result");
    expect(page).toContain('<main class="wrap page case-page">');
    // Indentation is how the generated markup says what nests in what: a
    // child of <main> starts two columns in from it, a child of the brief
    // four.
    const main = page.match(/^( *)<main class="wrap page case-page">$/m)[1];
    expect(page).toContain(`\n${main}  <div class="case-brief`);
    expect(page).toContain(`\n${main}  <nav class="case-index`);
  });

  test("stays off a case study short enough to take in at a glance", () => {
    expect(pageFor("Problem", "Result")).not.toContain("case-index");
    expect(casePage).not.toContain("case-index");
  });

  test("slugifies a label with punctuation and spaces", () => {
    const page = pageFor("What broke", "The fix (v2)", "Result");
    expect(page).toContain('<a href="#what-broke">What broke</a>');
    expect(page).toContain('<a href="#the-fix-v2">The fix (v2)</a>');
  });

  /** Two links to the same id would both land on the first section. */
  test("keeps the ids unique when two sections share a label", () => {
    const page = pageFor("Result", "Result", "Result");
    expect(page).toContain('<a href="#result">');
    expect(page).toContain('<a href="#result-2">');
    expect(page).toContain('<a href="#result-3">');
    expect(page).toContain('id="result-3"');
  });
});

describe("status", () => {
  const withStatus = (slug, order, status) => ({
    ...project,
    slug,
    order,
    status,
  });

  test("drops the status most projects share from the tiles, keeping the exception", () => {
    const page = filesOf([
      withStatus("a", 1, "In production"),
      withStatus("b", 2, "In production"),
      withStatus("c", 3, "Archived"),
    ]).get("/projects/index.html");
    expect(page).not.toContain("In production");
    expect(page).toContain('<span class="b-status">Archived</span>');
  });

  test("keeps it when no status is the common one", () => {
    const page = filesOf([
      withStatus("a", 1, "In production"),
      withStatus("b", 2, "Archived"),
    ]).get("/projects/index.html");
    expect(page).toContain('<span class="b-status">In production</span>');
    expect(page).toContain('<span class="b-status">Archived</span>');
  });

  /** A sample of one is not a convention to hide anything against. */
  test("keeps it on a lone project's tile", () => {
    expect(indexPage).toContain('<span class="b-status">In production</span>');
  });

  test("states it in the case study's facts whatever the tiles do", () => {
    const files = filesOf([
      withStatus("a", 1, "In production"),
      withStatus("b", 2, "In production"),
    ]);
    expect(files.get("/projects/a.html")).toContain("<dd>In production</dd>");
  });
});

describe("figures on a case study", () => {
  /**
   * The caption carries the link, not the image. Wrapping the image made the
   * link's accessible name the whole alt text, and left `title` as the only
   * hint that it was a link at all.
   */
  test("offers each framed figure at full size, per theme, from its caption", () => {
    expect(casePage).toContain(
      '<a class="figure-open shot-light" href="/assets/figures/diagram-light.svg"',
    );
    expect(casePage).toContain(
      '<a class="figure-open shot-dark" href="/assets/figures/diagram-dark.svg"',
    );
    expect(casePage).toContain('target="_blank" rel="noopener"');
    expect(casePage).not.toContain("shot-link");
  });

  /** A region the mouse can scroll and the keyboard cannot is WCAG 2.1.1. */
  test("lets a keyboard into the frame it lets a mouse scroll", () => {
    expect(casePage).toContain('<span class="shot-frame" tabindex="0">');
  });

  /** A tile is already a link, cannot scroll, and needs neither. */
  test("leaves a tile's figure unframed and unlinked", () => {
    expect(indexPage).not.toContain("shot-frame");
    expect(indexPage).not.toContain("figure-open");
  });
});

describe("topics", () => {
  test("renders the tags as a plain list under a label", () => {
    expect(casePage).toContain(
      '<h2 class="block-title" data-glitch>Topics</h2>',
    );
    expect(casePage).toContain('<ul class="tag-list">');
    expect(casePage).toContain("<li>Backend</li>");
  });
});

describe("end navigation", () => {
  const named = (slug, order) => ({ ...project, slug, order });

  /** The Index *card*: "All projects" also appears in the row below it now. */
  const indexCard = '<span class="end-title">All projects</span>';

  test("falls back to the overview when a project stands alone", () => {
    expect(casePage).toContain(indexCard);
    expect(casePage).not.toContain("← Previous");
    expect(casePage).not.toContain("Next →");
  });

  test("links forward from the first project and back from the last", () => {
    const files = filesOf([named("first", 1), named("second", 2)]);
    const first = files.get("/projects/first.html");
    const second = files.get("/projects/second.html");
    expect(first).toContain("Next →");
    expect(first).not.toContain("← Previous");
    expect(second).toContain("← Previous");
    expect(second).toContain(indexCard);
  });

  /**
   * Previous, next, previous is a closed loop, and a reader who has just
   * finished the last section is the likeliest one this site has to want
   * something from. Both of these used to be reachable only from a topbar
   * that scrolled out of sight several thousand pixels ago.
   */
  test("ends every case study with a way out of the series", () => {
    const files = filesOf([named("first", 1), named("second", 2)]);
    for (const page of files.values()) {
      if (!page.includes("case-page")) continue;
      expect(page).toContain('<p class="end-more wrap">');
      expect(page).toContain("Questions about any of this?");
      expect(page).toContain('href="mailto:hi@example.com"');
      expect(page).toContain('data-umami-event="case-contact"');
      expect(page).toContain('<a class="end-more-link" href="/projects">');
    }
  });

  /** mailto: opens the mail client in place — the aside tiles' rule. */
  test("does not send a mailto: to a new tab", () => {
    const more = casePage.match(/<p class="end-more[\s\S]*?<\/p>/)[0];
    expect(more).not.toContain("_blank");
  });

  /**
   * The name of the next project is not enough to decide on, and this row is
   * the only place the decision is offered.
   */
  test("carries the next project's tagline, but none on the Index card", () => {
    const files = filesOf([named("first", 1), named("second", 2)]);
    expect(files.get("/projects/first.html")).toContain(
      '<span class="end-tagline">A demo project.</span>',
    );
    const alone = casePage.match(/<nav class="end-nav[\s\S]*?<\/nav>/)[0];
    expect(alone).toContain("All projects");
    expect(alone).not.toContain("end-tagline");
  });

  test("gives the fallback Index card the empty side, not always the right", () => {
    const files = filesOf([named("first", 1), named("second", 2)]);
    const first = files.get("/projects/first.html");
    const second = files.get("/projects/second.html");
    // No previous project: Index fills the left slot, left-aligned.
    expect(first).toContain("All projects");
    expect(first).toContain('<a class="end-card" href="/projects">');
    expect(first).not.toContain(
      '<a class="end-card end-next" href="/projects">',
    );
    // No next project: Index fills the right slot, right-aligned.
    expect(second).toContain('<a class="end-card end-next" href="/projects">');
    expect(second).not.toContain('<a class="end-card" href="/projects">');
  });
});

describe("overview page", () => {
  test("renders a tile per project plus the aside tiles from site.json", () => {
    expect(indexPage).toContain(
      '<a class="b-tile b-md-3x2 b-lg-3x2" href="/projects/demo"',
    );
    expect(indexPage).toContain('data-umami-event="project-demo"');
    expect(indexPage).toContain('<a class="b-tile b-aside b-md-3x2');
    expect(indexPage).toContain('data-umami-event="aside-github"');
  });

  /**
   * The mosaic itself is bento.test.js's subject; what matters here is that
   * the overview page lays out one run covering both kinds of tile. An aside
   * tile left out of the count would be shaped against a different set of
   * bands from the projects it sits beside, and the grid would have a hole.
   */
  test("shapes projects and aside tiles as one run, in render order", () => {
    const twoProjects = [
      { ...project, slug: "a", order: 1 },
      { ...project, slug: "b", order: 2 },
    ];
    const classesOf = (asideTiles) => {
      const page = createRenderer({
        site: { ...site, index: { ...site.index, asideTiles } },
        projects: twoProjects,
        figures,
        tokens,
      })
        .files()
        .find((f) => f.path === "/projects/index.html").content;
      return [...page.matchAll(/<a class="b-tile ([^"]+)"/g)].map(
        ([, value]) => value,
      );
    };

    // Two tiles alone are a duet: the band is split down the middle.
    expect(classesOf([])).toEqual(["b-md-3x2 b-lg-3x2", "b-md-3x2 b-lg-3x2"]);

    // Adding the aside tile makes it three, so the band becomes a hero with
    // two shorter tiles stacked beside it — which is only true if the aside
    // went through the layout with them.
    expect(classesOf(site.index.asideTiles)).toEqual([
      "b-md-3x2 b-lg-4x2",
      "b-md-3x1 b-md-compact b-lg-2x1 b-lg-compact",
      "b-aside b-md-3x1 b-md-compact b-lg-2x1 b-lg-compact",
    ]);
  });

  /**
   * The shape is decided by position, so nothing about the tile's copy can be:
   * the same tile is a different rectangle at each breakpoint and only CSS
   * knows which. Every tile therefore carries the whole of its content and
   * lets the stylesheet drop what does not fit.
   */
  test("gives every tile its figure and stack, whatever shape it ends up", () => {
    const page = createRenderer({
      site: { ...site, index: { ...site.index, asideTiles: [] } },
      projects: [
        { ...project, slug: "a", order: 1 },
        { ...project, slug: "b", order: 2 },
        { ...project, slug: "c", order: 3 },
      ],
      figures,
      tokens,
    })
      .files()
      .find((f) => f.path === "/projects/index.html").content;
    // A hero and two tiles stacked beside it: only the hero is big enough for
    // a figure, and all three carry one regardless.
    expect(page.match(/b-lg-compact/g)).toHaveLength(2);
    expect(page.match(/<span class="b-media">/g)).toHaveLength(3);
    expect(page.match(/<span class="b-stack">/g)).toHaveLength(3);
  });

  /**
   * The first tile is the largest thing above the fold at every width, so it
   * is the one figure worth blocking the render on. Everything below it waits
   * until it is scrolled to.
   */
  test("loads only the first tile's cover eagerly", () => {
    expect(indexPage.match(/loading="eager"/g)).toHaveLength(2); // light + dark
    const twoProjects = filesOf([
      { ...project, slug: "a", order: 1 },
      { ...project, slug: "b", order: 2 },
    ]).get("/projects/index.html");
    expect(twoProjects.match(/loading="eager"/g)).toHaveLength(2);
    expect(twoProjects.match(/loading="lazy"/g)).toHaveLength(2);
  });

  test("opens an off-site aside tile in a new tab, safely", () => {
    expect(indexPage).toContain(
      'href="https://github.com/example" target="_blank" rel="noopener noreferrer"',
    );
  });

  test("does not open a mailto: aside tile in a new tab", () => {
    const withMailto = createRenderer({
      site: {
        ...site,
        index: {
          ...site.index,
          asideTiles: [
            {
              label: "Say hello",
              title: "Email",
              text: "Get in touch.",
              cta: "Write",
              href: "mailto:hi@example.com",
              umamiEvent: "aside-email",
            },
          ],
        },
      },
      projects: [project],
      figures,
      tokens,
    })
      .files()
      .find((f) => f.path === "/projects/index.html").content;
    expect(withMailto).toContain('href="mailto:hi@example.com"');
    expect(withMailto).not.toContain('target="_blank"');
  });

  test("works with no aside tiles at all", () => {
    const bare = createRenderer({
      site: { ...site, index: { ...site.index, asideTiles: [] } },
      projects: [project],
      figures,
      tokens,
    })
      .files()
      .find((f) => f.path === "/projects/index.html").content;
    expect(bare).not.toContain("b-aside");
    expect(bare).toContain('<section class="bento" aria-label="Projects">');
  });
});

describe("sitemap", () => {
  test("lists the home page, the overview and every project", () => {
    expect(sitemap).toContain("<loc>https://example.com/</loc>");
    expect(sitemap).toContain("<loc>https://example.com/projects</loc>");
    expect(sitemap).toContain("<loc>https://example.com/projects/demo</loc>");
  });

  test("takes each project's lastmod from the project, not the clock", () => {
    expect(sitemap).toContain("<lastmod>2026-01-03</lastmod>");
    expect(sitemap).not.toContain(new Date().toISOString().slice(0, 10));
  });

  test("orders projects by `order`, matching the overview grid", () => {
    const files = filesOf([
      { ...project, slug: "second", order: 2 },
      { ...project, slug: "first", order: 1 },
    ]);
    const locs = [...files.get("/sitemap.xml").matchAll(/<loc>(.*?)<\/loc>/g)];
    expect(locs.map(([, loc]) => loc)).toEqual([
      "https://example.com/",
      "https://example.com/projects",
      "https://example.com/projects/first",
      "https://example.com/projects/second",
    ]);
  });
});

describe("escaping", () => {
  /**
   * Nothing in content/ is parsed as markup — every value is escaped and
   * rendered as text. That is a promise to whoever writes the JSON (an
   * ampersand in a project name is just an ampersand) before it is a security
   * property, but it is both, and it has to hold in attributes too.
   */
  test("escapes content that would otherwise be read as markup", () => {
    const page = filesOf([
      {
        ...project,
        name: '<script>alert("x")</script>',
        summary: "Tom & Jerry",
        cover: { ...project.cover, alt: 'A "wide" diagram' },
      },
    ]).get("/projects/demo.html");

    expect(page).not.toContain("<script>alert");
    expect(page).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(page).toContain("Tom &amp; Jerry");
    expect(page).toContain('alt="A &quot;wide&quot; diagram"');
  });

  /**
   * The page body escapes markup, but JSON-LD is a second, separate context:
   * inside <script>, the HTML parser ends the element at `</script` no matter
   * what the surrounding JSON thinks, so a name containing one would break out
   * of the block and the rest would be parsed as markup. The value still has
   * to survive intact for whoever reads the JSON.
   */
  test("cannot break out of the JSON-LD block, and still round-trips", () => {
    const name = 'A </script><img src=x> & "quoted" project';
    const page = filesOf([{ ...project, name }]).get("/projects/demo.html");

    const scripts = page.match(/<script type="application\/ld\+json">/g);
    expect(scripts).toHaveLength(1);
    expect(page).not.toContain("</script><img");
    expect(page).not.toContain("<img src=x>");

    const json = JSON.parse(
      page.match(
        /<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/,
      )[1],
    );
    expect(json.name).toBe(name);
  });
});
