import { describe, expect, test } from "bun:test";
import { ContentError, validateContent } from "./content-schema.js";

/**
 * These fixtures are the smallest input that satisfies every schema and
 * cross-check at once. Each test mutates a copy of them to break exactly one
 * rule, so a failure here points at the one thing that changed rather than
 * requiring the reader to diff a whole fixture.
 *
 * This file exercises the hand-rolled parts of content-schema.js — the
 * cross-file checks Zod can't express on its own (slug/filename agreement,
 * figure references, stray files) — since those are the
 * parts most likely to silently break under a refactor. Per-field shape
 * (regexes, enums, `strictObject`) is Zod's own behaviour, exercised only
 * where it interacts with those checks.
 */

const validSite = {
  origin: "https://example.com",
  author: "Test Author",
  locale: "en_GB",
  umamiWebsiteId: "12345678-1234-1234-1234-123456789012",
  ogImage: "/og.png",
  basePath: "/projects",
  figureDir: "/assets/figures",
  sitemap: {
    home: { lastmod: "2026-01-01", changefreq: "weekly", priority: "1.0" },
    index: { lastmod: "2026-01-01", changefreq: "weekly", priority: "0.9" },
    project: { changefreq: "monthly", priority: "0.8" },
  },
  index: {
    title: "Projects",
    description: "Selected work.",
    eyebrow: "Work",
    heading: "Projects",
    intro: "A short intro.",
    asideTiles: [],
  },
};

const validProject = {
  slug: "demo",
  order: 1,
  size: "normal",
  name: "Demo",
  tagline: "A demo project.",
  period: "2026",
  stack: ["TypeScript"],
  tags: ["web"],
  status: "Live",
  lastmod: "2026-01-01",
  seo: { title: "Demo", description: "A demo project for tests." },
  cover: { figure: "diagram", alt: "A diagram" },
  summary: "What this project is.",
  sections: [
    {
      label: "Overview",
      heading: "Overview",
      blocks: [{ type: "text", value: "Hello." }],
    },
  ],
};

const validFigureSource =
  '<svg viewBox="0 0 100 100"><rect fill="{{bg}}" /></svg>';

const validTokens = {
  light: { bg: "#ffffff" },
  dark: { bg: "#000000" },
};

/** Runs validateContent against the fixtures with the given overrides. */
function validate({ site, project, figures, figureFiles, tokens } = {}) {
  const resolvedFigures = figures ?? new Map([["diagram", validFigureSource]]);
  validateContent({
    site: site ?? validSite,
    projects: [
      { file: "content/projects/demo.json", data: project ?? validProject },
    ],
    figures: resolvedFigures,
    figureFiles:
      figureFiles ?? [...resolvedFigures.keys()].map((n) => `${n}.svg`),
    tokens: tokens ?? validTokens,
  });
}

/** The aggregated ContentError message from calling `validate(overrides)`. */
function messageFor(overrides) {
  try {
    validate(overrides);
  } catch (error) {
    expect(error).toBeInstanceOf(ContentError);
    return error.message;
  }
  throw new Error("expected validate() to throw");
}

describe("validateContent", () => {
  test("accepts the minimal valid fixtures", () => {
    expect(() => validate()).not.toThrow();
  });

  test("rejects an unknown top-level key", () => {
    const message = messageFor({ project: { ...validProject, bogus: "x" } });
    expect(message).toContain("bogus");
  });

  test("rejects an unknown block type", () => {
    const message = messageFor({
      project: {
        ...validProject,
        sections: [
          {
            label: "Overview",
            heading: "Overview",
            blocks: [{ type: "carousel", value: "nope" }],
          },
        ],
      },
    });
    expect(message).toMatch(/type/i);
  });

  test("rejects a blank required string", () => {
    const message = messageFor({ project: { ...validProject, tagline: "  " } });
    expect(message).toContain("tagline");
    expect(message).toContain("non-empty");
  });

  describe("slug and order", () => {
    test("rejects a slug that doesn't match its filename", () => {
      const message = messageFor({
        project: { ...validProject, slug: "other" },
      });
      expect(message).toContain("does not match the filename");
    });

    test("rejects two projects sharing an order", () => {
      const projects = [
        { file: "content/projects/demo.json", data: validProject },
        {
          file: "content/projects/second.json",
          data: { ...validProject, slug: "second", order: validProject.order },
        },
      ];
      let message;
      try {
        validateContent({
          site: validSite,
          projects,
          figures: new Map([["diagram", validFigureSource]]),
          figureFiles: ["diagram.svg"],
          tokens: validTokens,
        });
      } catch (error) {
        message = error.message;
      }
      expect(message).toContain("order");
      expect(message).toContain("already used by");
    });
  });

  describe("figures", () => {
    test("rejects a figure block referencing a file that doesn't exist", () => {
      const message = messageFor({
        project: { ...validProject, cover: { figure: "missing", alt: "x" } },
      });
      expect(message).toContain("no content/figures/missing.svg");
    });

    test("rejects a figure file nothing references", () => {
      const message = messageFor({
        figures: new Map([
          ["diagram", validFigureSource],
          ["orphan", validFigureSource],
        ]),
      });
      expect(message).toContain("content/figures/orphan.svg");
      expect(message).toContain("not referenced by any project");
    });

    test("rejects a figure without a viewBox", () => {
      const message = messageFor({
        figures: new Map([["diagram", '<svg><rect fill="{{bg}}" /></svg>']]),
      });
      expect(message).toContain("viewBox");
    });

    test("rejects an SVG using an undefined palette token", () => {
      const message = messageFor({
        figures: new Map([
          [
            "diagram",
            '<svg viewBox="0 0 100 100"><rect fill="{{bgg}}" /></svg>',
          ],
        ]),
      });
      expect(message).toContain("unknown palette token {{bgg}}");
    });

    test("rejects a non-.svg file sitting in content/figures/", () => {
      const message = messageFor({ figureFiles: ["diagram.svg", ".DS_Store"] });
      expect(message).toContain("content/figures/.DS_Store");
      expect(message).toContain("not a .svg file");
    });
  });

  describe("SEO copy length", () => {
    test("accepts a title and description at the limit", () => {
      expect(() =>
        validate({
          project: {
            ...validProject,
            seo: { title: "x".repeat(60), description: "x".repeat(160) },
          },
        }),
      ).not.toThrow();
    });

    test("rejects a project SEO title search engines would truncate", () => {
      const message = messageFor({
        project: {
          ...validProject,
          seo: { ...validProject.seo, title: "x".repeat(61) },
        },
      });
      expect(message).toContain("seo.title");
      expect(message).toContain("truncate");
    });

    test("rejects a project SEO description search engines would truncate", () => {
      const message = messageFor({
        project: {
          ...validProject,
          seo: { ...validProject.seo, description: "x".repeat(161) },
        },
      });
      expect(message).toContain("seo.description");
      expect(message).toContain("truncate");
    });

    test("rejects an overlong index title in site.json", () => {
      const message = messageFor({
        site: {
          ...validSite,
          index: { ...validSite.index, title: "x".repeat(61) },
        },
      });
      expect(message).toContain("index.title");
    });
  });

  test("reports every problem in one error, not just the first", () => {
    const message = messageFor({
      site: {
        ...validSite,
        index: { ...validSite.index, title: "x".repeat(61) },
      },
      project: { ...validProject, slug: "wrong-slug" },
    });
    expect(message).toContain("2 problems");
    expect(message).toContain("index.title");
    expect(message).toContain("does not match the filename");
  });
});
