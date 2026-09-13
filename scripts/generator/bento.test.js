import { describe, expect, test } from "bun:test";
import {
  BREAKPOINTS,
  GRID_COLUMNS,
  MEDIA_MIN_SPAN,
  spansFor,
  TILE_SIZES,
  tileClasses,
} from "./bento.js";

/**
 * The layout is the part of the generator with no visible failure: a grid
 * with a hole in it still builds, still validates, still passes check:content,
 * and only shows up as a gap on the page nobody put there. These tests assert
 * the two properties the whole module exists for — every row is exactly
 * GRID_COLUMNS wide, and content/'s order is preserved — over every tile run
 * that can occur, rather than over the handful that happen to be in content/
 * at the moment.
 */

const MINIMUMS = BREAKPOINTS.map(({ minSpan }) => minSpan);
/** The two grids by name, so a case below says which one it is about. */
const WIDE = BREAKPOINTS.at(-1).minSpan;
const NARROW = BREAKPOINTS[0].minSpan;

/** Fold a flat run of spans back into the rows they must have come from. */
function rows(spans) {
  const out = [];
  let row = [];
  let width = 0;
  for (const span of spans) {
    row.push(span);
    width += span;
    if (width >= GRID_COLUMNS) {
      out.push(row);
      row = [];
      width = 0;
    }
  }
  if (row.length) out.push(row);
  return out;
}

/** Every run of `length` tiles, as size names. */
function* runs(length) {
  if (length === 0) {
    yield [];
    return;
  }
  for (const rest of runs(length - 1)) {
    for (const size of TILE_SIZES) yield [size, ...rest];
  }
}

describe("packing", () => {
  test("fills every row exactly, for every mix of sizes up to six tiles", () => {
    for (let length = 1; length <= 6; length++) {
      for (const sizes of runs(length)) {
        for (const minSpan of MINIMUMS) {
          const spans = spansFor(sizes, minSpan);
          const widths = rows(spans).map((row) =>
            row.reduce((sum, span) => sum + span, 0),
          );
          expect(`${sizes.join(",")}@${minSpan}: ${widths.join(",")}`).toBe(
            `${sizes.join(",")}@${minSpan}: ${widths.map(() => GRID_COLUMNS).join(",")}`,
          );
        }
      }
    }
  });

  test("gives every tile a span and keeps them in content order", () => {
    const sizes = ["flagship", "normal", "wide", "normal"];
    for (const minSpan of MINIMUMS) {
      expect(spansFor(sizes, minSpan)).toHaveLength(sizes.length);
    }
    // A flagship first means a flagship first, whatever that costs the rows
    // below it — `grid-auto-flow: dense` is exactly what this avoids.
    expect(spansFor(sizes, WIDE)[0]).toBe(GRID_COLUMNS);
  });

  /**
   * The case greedy packing gets wrong, and the reason rowCost squares: four
   * equal tiles fill one row of three and leave the fourth stretched across
   * the whole grid. Two rows of two is the answer a person would draw.
   */
  test("balances a run that would otherwise leave a stretched orphan", () => {
    expect(spansFor(["normal", "normal", "normal", "normal"], WIDE)).toEqual([
      3, 3, 3, 3,
    ]);
  });

  test("splits a row evenly when the tiles ask for the same width", () => {
    expect(spansFor(["normal", "normal", "normal"], WIDE)).toEqual([2, 2, 2]);
    expect(spansFor(["wide", "wide"], WIDE)).toEqual([3, 3]);
  });

  test("shares a mixed row out in proportion to what its tiles asked for", () => {
    expect(spansFor(["wide", "normal"], WIDE)).toEqual([4, 2]);
    expect(spansFor(["normal", "wide"], WIDE)).toEqual([2, 4]);
  });

  test("keeps a tile that asked for the whole row on a row of its own", () => {
    // A flagship asks for all six columns, so nothing else fits beside it and
    // the two normals behind it pair up on the next row instead.
    expect(spansFor(["flagship", "normal", "normal"], NARROW)).toEqual([
      6, 3, 3,
    ]);
  });

  /**
   * The only thing that differs between the two grids: the same three tiles
   * line up across the desktop grid, and pair off on the narrow one, because
   * a third of six columns is under the width a tile needs at 900px.
   */
  test("respects the breakpoint's minimum tile width", () => {
    const three = ["normal", "normal", "normal"];
    expect(spansFor(three, WIDE)).toEqual([2, 2, 2]);
    expect(spansFor(three, NARROW)).toEqual([3, 3, 6]);
    for (const minSpan of MINIMUMS) {
      for (const sizes of runs(5)) {
        const narrowest = Math.min(...spansFor(sizes, minSpan));
        expect(`${sizes.join(",")}@${minSpan}: ${narrowest >= minSpan}`).toBe(
          `${sizes.join(",")}@${minSpan}: true`,
        );
      }
    }
  });

  test("gives a single tile the full width whatever its size", () => {
    for (const size of TILE_SIZES) {
      for (const minSpan of MINIMUMS) {
        expect(spansFor([size], minSpan)).toEqual([GRID_COLUMNS]);
      }
    }
  });
});

describe("classes", () => {
  test("emits one span class per breakpoint, per tile", () => {
    const classes = tileClasses(["flagship", "normal", "normal"]);
    expect(classes).toHaveLength(3);
    for (const { prefix } of BREAKPOINTS) {
      expect(classes[0]).toContain(`b-${prefix}-`);
    }
  });

  /**
   * The media rule, and the only place the threshold is written down: a tile
   * under MEDIA_MIN_SPAN columns carries `-compact` for that breakpoint, and
   * public/css/bento.css hides the cover figure by that class rather than by
   * repeating the number.
   */
  test("marks a tile compact exactly where it is too narrow for a figure", () => {
    // Three normals share a desktop row at two columns each — under the
    // threshold — but only pair up on the narrow grid, at three columns.
    const [first] = tileClasses(["normal", "normal", "normal"]);
    expect(first).toContain("b-lg-2");
    expect(first).toContain("b-lg-compact");
    expect(first).toContain("b-md-3");
    expect(first).not.toContain("b-md-compact");
  });

  test("never marks a tile compact when it is wide enough", () => {
    for (const sizes of runs(4)) {
      const spans = Object.fromEntries(
        BREAKPOINTS.map(({ prefix, minSpan }) => [
          prefix,
          spansFor(sizes, minSpan),
        ]),
      );
      tileClasses(sizes).forEach((className, index) => {
        for (const { prefix } of BREAKPOINTS) {
          const compact = className.includes(`b-${prefix}-compact`);
          expect(`${sizes.join(",")}[${index}] ${prefix}: ${compact}`).toBe(
            `${sizes.join(",")}[${index}] ${prefix}: ${spans[prefix][index] < MEDIA_MIN_SPAN}`,
          );
        }
      });
    }
  });
});
