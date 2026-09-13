/**
 * Where every tile on the overview grid sits, decided at build time.
 *
 * The grid is six columns wide and a tile's `size` in content/ is what that
 * tile *asks for*, not what it gets. The generator cuts the run of tiles into
 * rows, then shares each row's six columns out in proportion to the asking, so
 * every row fills exactly — no holes, no ragged last row — whatever mix of
 * sizes content/ happens to contain.
 *
 * Fixed spans are what this replaces, and the reason is arithmetic: any rule
 * of the form "wide is three columns" leaves a gap the moment the sizes in
 * content/ don't add up to a multiple of the column count, and the author has
 * no way to close it except by changing a size to something they didn't mean.
 * Asking can't produce that state: a row is stretched or squeezed to the full
 * six columns, and the packer picks the cuts that distort the least.
 *
 * Doing it here rather than in CSS is not a preference. `grid-auto-flow: dense`
 * fills holes by reordering tiles away from DOM order, which moves the visual
 * order out of step with the tab order; and the spans themselves can't be
 * inline styles, because firebase.json's CSP has no 'unsafe-inline'. The
 * generator knows the whole list of tiles up front, so it can just solve it
 * and emit a class.
 *
 * Nothing here reads a file or knows what a project is — it takes size names
 * and returns class names, which is what lets bento.test.js assert the layout
 * of arbitrary tile runs without any content/ around it.
 */

/** Columns in the grid. Every row is filled to exactly this. */
export const GRID_COLUMNS = 6;

/**
 * How many of the six columns each `size` asks for. These are the widths the
 * desktop grid gives a tile whose row works out exactly — a `flagship` the
 * full width, a `wide` half of it, a `normal` a third — and elsewhere they are
 * the ratio a row is shared out by.
 *
 * Nothing below the smallest `minSpan` in BREAKPOINTS belongs here: a size
 * that asks for less than a row is willing to give can never get what it
 * asked for, at any breakpoint.
 *
 * Adding a size is a value here and nothing else — every span it can produce
 * already has a rule in public/css/bento.css, which covers 1..GRID_COLUMNS.
 */
export const TILE_SPANS = { flagship: 6, wide: 3, normal: 2 };

/** The `size` values content-schema.js accepts, from the same table. */
export const TILE_SIZES = Object.keys(TILE_SPANS);

/**
 * One entry per grid breakpoint in public/css/bento.css, widest last.
 *
 * `minSpan` is the narrowest a tile is allowed to get there, and it is the
 * only thing that differs between the two grids — everything else is the same
 * six columns. The desktop grid allows a third, so a row can hold three tiles.
 * The tablet-width grid allows a half and therefore two, because six columns
 * split three ways at 900px is narrower than a display-face title can carry.
 * Below the narrowest breakpoint the grid is a single column and no packing
 * happens at all.
 *
 * `prefix` is the class infix — the wide grid emits `b-lg-4`, and so on.
 */
export const BREAKPOINTS = [
  { prefix: "md", minSpan: 3 },
  { prefix: "lg", minSpan: 2 },
];

/**
 * The narrowest tile that still shows its cover figure. Below half the grid a
 * figure is a few hundred pixels wide, which turns these diagrams into an
 * illegible strip and the tile into a thumbnail with a caption — so a tile
 * that narrow drops to copy only and gives the space back to the title.
 *
 * The threshold lives here and nowhere else: tiles under it get a `-compact`
 * class, and the stylesheet hides the figure by that class rather than by
 * repeating the number.
 */
export const MEDIA_MIN_SPAN = 3;

/**
 * Share GRID_COLUMNS out across one row, in proportion to what its tiles asked
 * for, as whole columns that add up exactly and none narrower than `minSpan`.
 * Largest-remainder rather than rounding each share independently, which can
 * miss the total by a column either way.
 *
 * `fits` below is what keeps the floor from overshooting the row, so nothing
 * here has to take columns back; bento.test.js checks the total exhaustively
 * over every tile run rather than trusting that.
 */
function rowSpans(wanted, minSpan) {
  const total = wanted.reduce((sum, want) => sum + want, 0);
  const exact = wanted.map((want) => (want / total) * GRID_COLUMNS);
  const spans = exact.map((value) => Math.max(minSpan, Math.floor(value)));

  let short = GRID_COLUMNS - spans.reduce((sum, span) => sum + span, 0);
  const byRemainder = exact
    .map((value, index) => [value - Math.floor(value), index])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let i = 0; short > 0; i = (i + 1) % byRemainder.length) {
    spans[byRemainder[i][1]] += 1;
    short -= 1;
  }
  return spans;
}

/**
 * Whether a row can hold these tiles at all: the asking has to fit in six
 * columns, and every tile has to clear the breakpoint's minimum. The second
 * is what makes the two grids different — three tiles clear a third each and
 * fail a half each, so the same run pairs up on the narrow grid and lines up
 * three across on the wide one.
 */
function fits(wanted, minSpan) {
  const asked = wanted.reduce(
    (sum, want) => sum + Math.min(want, GRID_COLUMNS),
    0,
  );
  return asked <= GRID_COLUMNS && wanted.length * minSpan <= GRID_COLUMNS;
}

/**
 * How far a row lands from what its tiles asked for. A row whose asking adds
 * up to exactly six columns gives every tile its natural width; anything less
 * stretches them all past it, and the minimum span can squeeze one below it.
 * This is the total of those misses, squared — so one badly distorted tile
 * costs more than two mild ones.
 *
 * Which is the whole point: a lone `normal` left over at the end of the grid
 * and blown up to full width is the ugly case, and squaring is what makes the
 * packer prefer two half-width rows over a full row and a stretched orphan.
 */
function rowCost(wanted, minSpan) {
  const spans = rowSpans(wanted, minSpan);
  return wanted.reduce(
    (cost, want, index) =>
      cost + (spans[index] - Math.min(want, GRID_COLUMNS)) ** 2,
    0,
  );
}

/**
 * Cut the run of tiles into rows at the lowest total cost, keeping content/'s
 * order — the grid reads in `order`, and so does the tab order.
 *
 * Greedy packing gets this wrong often enough to matter (four `normal` tiles
 * fill a row and leave one stretched across the whole grid), so this is the
 * exhaustive answer instead: work backwards, and for each tile try every row
 * that can start there. `minSpan` caps a row at three tiles, so the inner loop
 * is bounded and this stays linear in the number of tiles.
 *
 * On a tie the later cut wins — `<=` below — which front-loads the full rows
 * and leaves the short one at the bottom, where a grid is read as ending.
 */
function packRows(wanted, minSpan) {
  const best = new Array(wanted.length + 1).fill(null);
  best[wanted.length] = { cost: 0, rows: [] };

  for (let start = wanted.length - 1; start >= 0; start--) {
    for (let length = 1; start + length <= wanted.length; length++) {
      const row = wanted.slice(start, start + length);
      if (!fits(row, minSpan)) break;

      const rest = best[start + length];
      const cost = rowCost(row, minSpan) + rest.cost;
      if (best[start] === null || cost <= best[start].cost + 1e-9) {
        best[start] = { cost, rows: [length, ...rest.rows] };
      }
    }
  }
  return best[0].rows;
}

/** The column span of every tile, in order, on a grid with this minimum. */
export function spansFor(sizes, minSpan) {
  const wanted = sizes.map((size) => TILE_SPANS[size]);
  const spans = [];
  let start = 0;
  for (const length of packRows(wanted, minSpan)) {
    spans.push(...rowSpans(wanted.slice(start, start + length), minSpan));
    start += length;
  }
  return spans;
}

/**
 * The bento classes for a run of tiles, in the order they are rendered:
 * one span class per breakpoint, plus `-compact` on the breakpoints where the
 * tile is too narrow to carry its cover figure.
 *
 * @param {string[]} sizes one `size` per tile, projects first
 * @returns {string[]} one space-separated class string per tile
 */
export function tileClasses(sizes) {
  const perBreakpoint = BREAKPOINTS.map(({ prefix, minSpan }) => ({
    prefix,
    spans: spansFor(sizes, minSpan),
  }));

  return sizes.map((_, index) =>
    perBreakpoint
      .flatMap(({ prefix, spans }) => {
        const span = spans[index];
        return span < MEDIA_MIN_SPAN
          ? [`b-${prefix}-${span}`, `b-${prefix}-compact`]
          : [`b-${prefix}-${span}`];
      })
      .join(" "),
  );
}
