import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkAssetLinks, publicDir } from "./build-content.js";

/**
 * checkAssetLinks is what catches a typo'd href/src before it ships as a
 * silent broken link — see build-content.js's own comment on it. The one
 * way it used to get this wrong: a protocol-relative URL ("//host/path")
 * also starts with "/", so it was briefly indistinguishable from a
 * root-relative path on this site and got checked against public/ instead
 * of being treated as external.
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
});
