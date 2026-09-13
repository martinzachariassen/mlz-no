import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkAssetLinks } from "./check-links.js";
import { publicDir } from "./paths.js";

/**
 * checkAssetLinks is what catches a typo'd href/src before it ships as a
 * silent broken link — see check-links.js's own comment. The one way it used
 * to get this wrong: a protocol-relative URL ("//host/path") also starts with
 * "/", so it was briefly indistinguishable from a root-relative path on this
 * site and got checked against public/ instead of being treated as external.
 */

const site = { origin: "https://example.com" };

/** A page containing the given refs, keyed the way build-content.js keys outputs. */
const page = (body) =>
  new Map([[join(publicDir, "/test-page.html"), `<!doctype html>${body}`]]);

describe("checkAssetLinks", () => {
  test("does not flag a protocol-relative URL as a broken local link", () => {
    const broken = checkAssetLinks(
      page('<script src="//cdn.example.com/lib.js"></script>'),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("flags a root-relative href that resolves to no file on disk", () => {
    const broken = checkAssetLinks(
      page('<link rel="stylesheet" href="/css/does-not-exist.css" />'),
      site,
    );
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain("/css/does-not-exist.css");
  });

  test("does not flag a root-relative href that resolves to a real file", () => {
    const broken = checkAssetLinks(
      page('<link rel="stylesheet" href="/css/tokens.css" />'),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("does not flag an off-site https:// link", () => {
    const broken = checkAssetLinks(
      page('<a href="https://other-site.example/page">x</a>'),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("flags a broken JSON-LD url field, not just href/src", () => {
    const broken = checkAssetLinks(
      page(
        '<script type="application/ld+json">{\n  "url": "https://example.com/projects/does-not-exist"\n}</script>',
      ),
      site,
    );
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain("/projects/does-not-exist");
  });

  test("does not flag a JSON-LD url that resolves", () => {
    const broken = checkAssetLinks(
      page(
        '<script type="application/ld+json">{\n  "url": "https://example.com/css/tokens.css"\n}</script>',
      ),
      site,
    );
    expect(broken).toEqual([]);
  });

  test("treats a stray file scheduled for removal as not resolving", () => {
    const strayPath = join(publicDir, "css", "tokens.css");
    const broken = checkAssetLinks(
      page('<link rel="stylesheet" href="/css/tokens.css" />'),
      site,
      new Set([strayPath]),
    );
    expect(broken).toHaveLength(1);
  });
});
