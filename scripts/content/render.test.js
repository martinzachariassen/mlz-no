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
        size: "normal",
        label: "Elsewhere",
        title: "GitHub",
        text: "Code I have published.",
        cta: "Browse",
        href: "https://github.com/example",
        umamiEvent: "aside-github",
      },
    ],
  },
};

/** One project carrying every block type and both optional facts. */
const project = {
  slug: "demo",
  order: 1,
  size: "flagship",
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
});

describe("case study blocks", () => {
  test("renders every block type in the spec", () => {
    expect(casePage).toContain('<p class="prose">A paragraph.</p>');
    expect(casePage).toContain('<ol class="prose-list">');
    expect(casePage).toContain('<ul class="prose-list">');
    expect(casePage).toContain('<p class="block-title" data-glitch>Steps</p>');
    expect(casePage).toContain("<figcaption>Fig.</figcaption>");
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
    expect(casePage).toContain('<p class="note-title" data-glitch>Caveat</p>');
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
});

describe("end navigation", () => {
  const named = (slug, order) => ({ ...project, slug, order });

  test("falls back to the overview when a project stands alone", () => {
    expect(casePage).toContain("All projects");
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
    expect(second).toContain("All projects");
  });
});

describe("overview page", () => {
  test("renders a tile per project plus the aside tiles from site.json", () => {
    expect(indexPage).toContain(
      '<a class="b-tile b-flagship" href="/projects/demo"',
    );
    expect(indexPage).toContain('data-umami-event="project-demo"');
    expect(indexPage).toContain('<a class="b-tile b-normal b-aside"');
    expect(indexPage).toContain('data-umami-event="aside-github"');
  });

  test("opens an off-site aside tile in a new tab, safely", () => {
    expect(indexPage).toContain(
      'href="https://github.com/example" target="_blank" rel="noopener noreferrer"',
    );
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
