import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BREAKPOINTS,
  GRID_COLUMNS,
  MEDIA_MIN_COLUMNS,
  MEDIA_MIN_ROWS,
  narrowShapes,
  tileClasses,
  wideShapes,
} from "./bento.js";
import { publicDir } from "./paths.js";

/**
 * The layout is the part of the generator with no visible failure: a grid with
 * a hole in it still builds, still validates, still passes check:content, and
 * only shows up as a gap on the page nobody put there.
 *
 * So rather than assert the shapes of one particular run, `place` below is the
 * browser's own sparse auto-placement algorithm — start at the cursor, take
 * the first position the tile fits, never move the cursor backwards — and the
 * tests run it over every project count the site could plausibly reach.
 */

/** The largest number of projects worth proving the layout for. */
const MOST = 30;
const COUNTS = Array.from({ length: MOST }, (_, i) => i + 1);

/**
 * Place `shapes` the way CSS grid does with the default `grid-auto-flow: row`,
 * and return the occupancy map. Deliberately a reimplementation rather than a
 * reading of bento.js: if the module's idea of a band disagrees with how a
 * browser actually flows it, that shows up here as an empty cell.
 */
function place(shapes) {
  const grid = [];
  const taken = (row, column) => grid[row]?.[column] === true;
  const free = (row, column, width, height) => {
    for (let r = row; r < row + height; r++) {
      for (let c = column; c < column + width; c++) {
        if (taken(r, c)) return false;
      }
    }
    return true;
  };

  let cursorRow = 0;
  let cursorColumn = 0;
  for (const [width, height] of shapes) {
    let row = cursorRow;
    let column = cursorColumn;
    while (column + width > GRID_COLUMNS || !free(row, column, width, height)) {
      if (column + width > GRID_COLUMNS) {
        row += 1;
        column = 0;
      } else {
        column += 1;
      }
    }
    for (let r = row; r < row + height; r++) {
      grid[r] ??= [];
      for (let c = column; c < column + width; c++) grid[r][c] = true;
    }
    cursorRow = row;
    cursorColumn = column + width;
  }
  return grid;
}

/** Which cells a placement left empty, as "row,column" strings. */
function holes(grid) {
  const empty = [];
  grid.forEach((row, r) => {
    for (let c = 0; c < GRID_COLUMNS; c++) {
      if (row?.[c] !== true) empty.push(`${r},${c}`);
    }
  });
  return empty;
}

describe("tiling", () => {
  test("leaves no empty cell, at any project count, on either grid", () => {
    for (const { prefix, shapes } of BREAKPOINTS) {
      for (const count of COUNTS) {
        const empty = holes(place(shapes(count)));
        expect(`${prefix} ${count}: ${empty.join(" ")}`).toBe(
          `${prefix} ${count}: `,
        );
      }
    }
  });

  test("gives every tile exactly one shape, none wider than the grid", () => {
    for (const { prefix, shapes } of BREAKPOINTS) {
      for (const count of COUNTS) {
        const all = shapes(count);
        expect(`${prefix} ${count}: ${all.length}`).toBe(
          `${prefix} ${count}: ${count}`,
        );
        for (const [columns, rows] of all) {
          expect(`${prefix} ${count}: ${columns}x${rows}`).toBe(
            `${prefix} ${count}: ${Math.min(columns, GRID_COLUMNS)}x${Math.max(rows, 1)}`,
          );
        }
      }
    }
  });
});

describe("the ramp", () => {
  /**
   * The one thing the reader is promised: the newest project is the biggest
   * tile, and it is in the top-left corner because it is placed first.
   */
  test("gives the first project the largest tile", () => {
    for (const { prefix, shapes } of BREAKPOINTS) {
      for (const count of COUNTS) {
        const areas = shapes(count).map(([columns, rows]) => columns * rows);
        expect(`${prefix} ${count}: ${areas[0]}`).toBe(
          `${prefix} ${count}: ${Math.max(...areas)}`,
        );
      }
    }
  });

  /**
   * The grid gets denser downwards and never climbs back: once it has dropped
   * to single-row bands, every tile below is single-row too.
   */
  test("never grows back to a taller tile further down the grid", () => {
    for (const { prefix, shapes } of BREAKPOINTS) {
      for (const count of COUNTS) {
        const rows = shapes(count).map(([, height]) => height);
        const settled = rows.lastIndexOf(2) + 1;
        expect(`${prefix} ${count}: ${rows.slice(settled).join("")}`).toBe(
          `${prefix} ${count}: ${rows
            .slice(settled)
            .map(() => 1)
            .join("")}`,
        );
      }
    }
  });

  /**
   * Four projects are the case the band catalogue exists to get right: a hero
   * takes three, which would leave one tile to be stretched across the whole
   * grid under it. The opener steps down to two duets instead.
   */
  test("opens with duets where a hero would strand a single tile", () => {
    expect(wideShapes(4)).toEqual([
      [3, 2],
      [3, 2],
      [3, 2],
      [3, 2],
    ]);
  });

  test("stacks two smaller tiles beside the hero", () => {
    expect(wideShapes(3)).toEqual([
      [4, 2],
      [2, 1],
      [2, 1],
    ]);
  });

  test("follows the hero with halves a size down", () => {
    expect(wideShapes(5)).toEqual([
      [4, 2],
      [2, 1],
      [2, 1],
      [3, 2],
      [3, 2],
    ]);
  });

  /**
   * The run the site itself is at: a hero, halves, then thirds — each band a
   * step denser than the one above it.
   */
  test("descends hero, duet, trio over eight projects", () => {
    expect(wideShapes(8)).toEqual([
      [4, 2],
      [2, 1],
      [2, 1],
      [3, 2],
      [3, 2],
      [2, 1],
      [2, 1],
      [2, 1],
    ]);
  });

  /**
   * No single-row shape is wider than a third, at any count: a `[3,1]` on the
   * desktop grid is a 3:1 slab, and a band of them reads as stacked banners.
   */
  test("never emits a wide single-row tile", () => {
    for (const count of COUNTS) {
      const slabs = wideShapes(count).filter(
        ([columns, rows]) => rows === 1 && columns > 2,
      );
      expect(`${count}: ${slabs.length}`).toBe(`${count}: 0`);
    }
  });

  test("falls to thirds once the openers are spent", () => {
    expect(wideShapes(9).slice(6)).toEqual([
      [2, 1],
      [2, 1],
      [2, 1],
    ]);
  });

  test("pairs tiles two across on the narrow grid", () => {
    expect(narrowShapes(5)).toEqual([
      [3, 2],
      [3, 1],
      [3, 1],
      [3, 1],
      [3, 1],
    ]);
    // An odd tail has nobody to sit beside, so it takes the row.
    expect(narrowShapes(4).at(-1)).toEqual([6, 1]);
  });
});

describe("classes", () => {
  test("emits one shape class per breakpoint, per tile", () => {
    const classes = tileClasses(6);
    expect(classes).toHaveLength(6);
    expect(classes[0]).toBe("b-md-3x2 b-lg-4x2");
  });

  /**
   * The media rule, and the only place the thresholds are written down: a tile
   * too narrow or too short for a figure carries `-compact` for that
   * breakpoint, and public/css/bento.css hides the figure by that class.
   */
  test("marks a tile compact exactly where it is too small for a figure", () => {
    for (const count of COUNTS) {
      const shapes = Object.fromEntries(
        BREAKPOINTS.map(({ prefix, shapes: of }) => [prefix, of(count)]),
      );
      tileClasses(count).forEach((className, index) => {
        for (const { prefix } of BREAKPOINTS) {
          const [columns, rows] = shapes[prefix][index];
          const wanted = columns < MEDIA_MIN_COLUMNS || rows < MEDIA_MIN_ROWS;
          const marked = className.includes(`b-${prefix}-compact`);
          expect(`${prefix} ${count}[${index}]: ${marked}`).toBe(
            `${prefix} ${count}[${index}]: ${wanted}`,
          );
        }
      });
    }
  });

  /**
   * A shape with no rule in the stylesheet is a tile that silently falls back
   * to one column — the layout looks broken and nothing fails. The catalogue
   * is small and closed, so the stylesheet is checked against it directly
   * rather than carrying a speculative rule for every size the grid allows.
   */
  test("every shape it can emit has a rule in public/css/bento.css", () => {
    const css = readFileSync(join(publicDir, "css", "bento.css"), "utf8");
    const emitted = new Set(
      COUNTS.flatMap((count) => tileClasses(count)).flatMap((value) =>
        value.split(" "),
      ),
    );
    const missing = [...emitted].filter(
      (name) => !new RegExp(`\\.${name}[\\s,{]`).test(css),
    );
    expect(missing.join(" ")).toBe("");
  });
});
