import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { findStrays, spliceChrome } from "./build-content.js";
import { ContentError } from "./content-schema.js";
import { publicDir } from "./paths.js";

/**
 * spliceChrome is the only thing standing between an edit inside a
 * <!-- generated:name --> region and it silently going stale — see its own
 * comment in build-content.js. Both error paths matter as much as the happy
 * path: a region naming an unknown block, and a block with no region to land
 * in, are the two ways that guarantee can quietly break.
 */
describe("spliceChrome", () => {
  test("replaces a region's body with the named block, re-indented to the marker", () => {
    const source = [
      "<body>",
      "  <!-- generated:topbar -->",
      "  <p>stale</p>",
      "  <!-- /generated:topbar -->",
      "</body>",
    ].join("\n");
    const out = spliceChrome(
      source,
      { topbar: "<nav>fresh</nav>\n<a>link</a>" },
      "test.html",
    );
    expect(out).toBe(
      [
        "<body>",
        "  <!-- generated:topbar -->",
        "  <nav>fresh</nav>",
        "  <a>link</a>",
        "  <!-- /generated:topbar -->",
        "</body>",
      ].join("\n"),
    );
  });

  test("throws when a region names a block that doesn't exist", () => {
    const source = [
      "<!-- generated:typo -->",
      "x",
      "<!-- /generated:typo -->",
    ].join("\n");
    expect(() => spliceChrome(source, { topbar: "x" }, "test.html")).toThrow(
      ContentError,
    );
  });

  test("throws when a block has no matching region", () => {
    const source = [
      "<!-- generated:topbar -->",
      "x",
      "<!-- /generated:topbar -->",
    ].join("\n");
    expect(() =>
      spliceChrome(source, { topbar: "x", footer: "y" }, "test.html"),
    ).toThrow(ContentError);
  });
});

/**
 * findStrays is what notices a renamed/removed project left its old case
 * study on disk. It's exercised end-to-end by `bun run check:content`
 * against the real content/ and public/ trees, but that never runs with a
 * stray file present — this drives it directly instead of leaving that path
 * only covered by the accident of nobody renaming a project mid-review.
 */
describe("findStrays", () => {
  const site = { basePath: "/projects", figureDir: "/assets/figures" };

  /** Every real file under the two managed directories, as an outputs Map. */
  const realOutputs = () => {
    const dirs = [
      join(publicDir, site.basePath),
      join(publicDir, site.figureDir),
    ];
    const outputs = new Map();
    for (const dir of dirs) {
      for (const entry of readdirSync(dir, {
        recursive: true,
        withFileTypes: true,
      })) {
        if (entry.isFile()) {
          outputs.set(join(entry.parentPath, entry.name), "");
        }
      }
    }
    return outputs;
  };

  test("finds nothing stray when outputs cover every file on disk", () => {
    expect(findStrays(realOutputs(), site)).toEqual([]);
  });

  test("flags a file on disk that outputs doesn't account for", () => {
    const outputs = realOutputs();
    const [strayPath] = outputs.keys();
    outputs.delete(strayPath);
    expect(findStrays(outputs, site)).toEqual([strayPath]);
  });

  test("ignores directories that don't exist on disk", () => {
    expect(
      findStrays(new Map(), { basePath: "/no-such-dir", figureDir: "/nope" }),
    ).toEqual([]);
  });
});
