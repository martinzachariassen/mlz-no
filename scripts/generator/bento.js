/**
 * The shape of every tile on the overview grid, decided at build time.
 *
 * The grid is six columns, and a tile occupies a rectangle of them: `[4, 2]`
 * is four columns wide and two rows tall. Tiles therefore interlock in both
 * directions — a tall one on the left with two shorter ones stacked beside it
 * — rather than sitting in a row of equal heights.
 *
 * Nothing in content/ chooses a shape. Position does: the run is cut into
 * *bands*, each a rectangle exactly six columns wide, and the bands descend —
 * the newest project gets the largest tile, top left, and they get smaller and
 * denser down the page. So the only thing an author decides is `order`.
 *
 *   hero     [4,2] [2,1] [2,1]     the newest, with two stacked beside it
 *   duet     [3,2] [3,2]           halves, a size down from the hero
 *   trio     [2,1] [2,1] [2,1]     thirds — the densest row
 *   solo     [6,2]                 one project is its own band
 *
 * Every shape in the catalogue lands between 1.15:1 and 1.6:1 at desktop
 * width, which is why there is no single-row shape wider than a third: a
 * six-column grid on a 230px row makes `[3,1]` a 3:1 slab, and a run of them
 * reads as stacked banners rather than as a mosaic. Halves are two rows tall
 * or they are not halves.
 *
 * Because every band is a full-width rectangle, concatenating them tiles the
 * grid exactly — no holes, no ragged last row, for any number of projects.
 * That is what lets the markup stay in content/'s order and rely on ordinary
 * (sparse) grid auto-placement: `grid-auto-flow: dense` would fill holes by
 * reordering tiles out of step with the tab order, and the spans can't be
 * inline styles because firebase.json's CSP has no 'unsafe-inline'. So each
 * tile gets a class naming its rectangle and the stylesheet does the rest.
 *
 * bento.test.js simulates the browser's auto-placement algorithm over every
 * project count and asserts that no cell is left empty — the failure this
 * module exists to prevent, and one that otherwise only shows up as a gap on
 * the page that nobody put there.
 */

/** Columns in the grid. Every band is exactly this wide. */
export const GRID_COLUMNS = 6;

/**
 * A tile carries its cover figure only where it is both wide enough for one of
 * these diagrams to resolve and tall enough to hold a band as well as the
 * copy. Under either, it drops to text and spends the room on the title —
 * which is most tiles, and the point: a few large tiles anchor the grid and
 * the rest are dense.
 *
 * The thresholds live here and nowhere else. A tile that fails them gets a
 * `-compact` class for that breakpoint, and the stylesheet keys off the class
 * rather than repeating the numbers.
 */
export const MEDIA_MIN_COLUMNS = 3;
export const MEDIA_MIN_ROWS = 2;

/* ----------------------------------------------------------- wide grid */

const HERO = [
  [4, 2],
  [2, 1],
  [2, 1],
];
const DUET = [
  [3, 2],
  [3, 2],
];
const TRIO = [
  [2, 1],
  [2, 1],
  [2, 1],
];
const SOLO = [[6, 2]];

/**
 * The bands under the opening hero, densest last: duets before trios, so the
 * grid keeps getting tighter rather than jumping back up.
 *
 * A `duet` is two tiles and a `trio` three, so every count but one can be
 * covered — and one never reaches here, because `wideShapes` never leaves a
 * single tile over. Zero does: three projects are a hero and nothing else.
 */
function tailBands(count) {
  const duets = count % 3 === 0 ? 0 : count % 3 === 2 ? 1 : 2;
  const trios = (count - duets * 2) / 3;
  return [
    ...Array.from({ length: duets }, () => DUET),
    ...Array.from({ length: trios }, () => TRIO),
  ].flat();
}

/** One `[columns, rows]` per tile on the desktop grid, in content order. */
export function wideShapes(count) {
  if (count === 1) return [...SOLO];
  if (count === 2) return [...DUET];
  // A hero takes three, and four would leave exactly one behind — so the run
  // opens on two duets instead, rather than stranding a tile under the hero.
  if (count === 4) return [...DUET, ...DUET];

  return [...HERO, ...tailBands(count - HERO.length)];
}

/* --------------------------------------------------------- narrow grid */

/**
 * The tablet-width grid, which is the same six columns two tiles across: a
 * third of them is under the width a display-face title can carry at 900px.
 *
 * It is computed from the count rather than from the bands above, because it
 * does not have to agree with them — the markup is one run of tiles in
 * content's order, and each breakpoint shapes it independently. Keeping the
 * two in step would mean a band that reads as dense on the desktop grid (a
 * trio) having to become something else here anyway.
 */
export function narrowShapes(count) {
  if (count === 1) return [[6, 2]];
  if (count === 2) {
    return [
      [3, 2],
      [3, 2],
    ];
  }

  const rest = Array.from({ length: count - 3 }, () => [3, 1]);
  // An odd tail leaves one tile without a partner; it takes the row instead.
  if (rest.length % 2 === 1) rest[rest.length - 1] = [6, 1];
  return [[3, 2], [3, 1], [3, 1], ...rest];
}

/* --------------------------------------------------------------- classes */

/** One entry per grid breakpoint in public/css/bento.css, widest last. */
export const BREAKPOINTS = [
  { prefix: "md", shapes: narrowShapes },
  { prefix: "lg", shapes: wideShapes },
];

/**
 * The bento classes for a run of tiles, in the order they are rendered: one
 * shape class per breakpoint (`b-lg-4x2` is four columns by two rows), plus
 * `-compact` on the breakpoints where the tile is too small for its figure.
 *
 * @param {number} count how many tiles the grid holds, projects first
 * @returns {string[]} one space-separated class string per tile
 */
export function tileClasses(count) {
  const perBreakpoint = BREAKPOINTS.map(({ prefix, shapes }) => ({
    prefix,
    shapes: shapes(count),
  }));

  return Array.from({ length: count }, (_, index) =>
    perBreakpoint
      .flatMap(({ prefix, shapes }) => {
        const [columns, rows] = shapes[index];
        const shape = `b-${prefix}-${columns}x${rows}`;
        const carriesMedia =
          columns >= MEDIA_MIN_COLUMNS && rows >= MEDIA_MIN_ROWS;
        return carriesMedia ? [shape] : [shape, `b-${prefix}-compact`];
      })
      .join(" "),
  );
}
