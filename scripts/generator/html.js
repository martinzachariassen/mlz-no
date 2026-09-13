/**
 * The template engine the generated pages are written with. Pure string
 * handling — nothing here reads content/, touches the filesystem or knows
 * what a project is, so every rule below is pinned by html.test.js rather
 * than inferred from whatever a page happened to look like.
 *
 * Three concerns, in order of how often you'll meet them:
 *
 *   esc          escape a value for HTML text or a double-quoted attribute
 *   html``       compose markup, handling indentation and empty values
 *   raw/unraw    protect newlines that are content, not layout
 */

/* ------------------------------------------------------------- escaping */

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Escape a value for use in HTML text or a double-quoted attribute. */
export const esc = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ESCAPES[c]);

/* --------------------------------------------------------- raw newlines */

/**
 * Marks text whose line breaks must reach the output byte-for-byte — the
 * lines of a <pre><code> block, which are meaningful whitespace, not layout.
 *
 * Without this, a code block would pick up one more level of indentation each
 * time the section around it gets embedded a level higher (case study section
 * inside page inside document), because `html` can't otherwise tell "a line
 * break that's part of the content" apart from "a line break in the
 * surrounding markup". Hiding the real newlines behind a private character
 * until the whole page is assembled means no reindenting pass ever sees them.
 *
 * `unraw` is the other half, and render.js calls it in exactly one place —
 * see `output()` there — so a new kind of page can't forget to.
 */
const RAW_NEWLINE = "\u0001";
export const raw = (text) => String(text).split("\n").join(RAW_NEWLINE);
export const unraw = (text) => text.split(RAW_NEWLINE).join("\n");

/* ------------------------------------------------------------ composing */

/** Strips the common leading whitespace off every line but the first. */
export function dedent(text) {
  const [first, ...rest] = text.split("\n");
  const indents = rest
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^[ \t]*/)[0].length);
  const width = indents.length ? Math.min(...indents) : 0;
  return [first, ...rest.map((line) => line.slice(width))].join("\n");
}

/**
 * What a template hole is allowed to hold: a scalar (rendered as text), or an
 * array of already-rendered pieces (flattened and newline-joined, so a
 * `.map()` call can be dropped straight into a hole). `0` and `false` are
 * kept as text only where they're meaningful — the values that mean "nothing
 * here" for this site's content (blank string, null, undefined, or a
 * `.filter`-ed-out `false`) are dropped, and `0` is not one of them.
 */
export function render(value) {
  if (Array.isArray(value)) {
    return value
      .flat(Number.POSITIVE_INFINITY)
      .filter((item) => item !== "" && item !== false && item != null)
      .join("\n");
  }
  if (value === "" || value === false || value == null) return "";
  return String(value);
}

/**
 * Tagged template for the generated HTML/XML.
 *
 * Each renderer writes its own markup indented however reads best in the JS
 * source; that source indentation is stripped automatically. When a template
 * embeds another renderer's output on its own line — a nested `${topbar(...)}`
 * sitting alone between two newlines — the whole block is shifted as a group
 * to that line's column. Composing one function inside another therefore
 * needs no manual padding of the child's output, and the committed HTML nests
 * the way the markup actually nests. Indentation is computed once, at the one
 * place it's known: where a value is substituted.
 *
 * An interpolated value that's empty — `""`, `null`, `undefined`, or an array
 * that flattens to nothing — drops its entire line rather than leaving a blank
 * one, so optional content (a caption, an aside tile, a project with no
 * `role`) disappears cleanly instead of leaving a gap. `render()` is the one
 * place that decides what counts as empty; it does not touch a value's own
 * internal blank lines (a code block's blank separator lines survive, because
 * they're inside a string, not a template hole).
 */
export function html(strings, ...values) {
  // A private separator lets `dedent` see the whole template source at once —
  // the common indent can only be measured across every line together — while
  // still marking where each value goes once the width is known.
  const HOLE = "\u0000";
  const parts = dedent(strings.join(HOLE)).split(HOLE);

  let out = parts[0];
  for (let i = 0; i < values.length; i++) {
    const next = parts[i + 1];
    const indent = /[ \t]*$/.exec(out)[0];
    const aloneOnLine =
      /(?:^|\n)[ \t]*$/.test(out) && /^[ \t]*(\n|$)/.test(next);
    const text = render(values[i]);

    if (aloneOnLine && text === "") {
      out = out.slice(0, out.length - indent.length);
      out += next.replace(/^[ \t]*\n?/, "");
      continue;
    }

    out += text.split("\n").join(`\n${indent}`) + next;
  }

  return out.replace(/^\n/, "").replace(/\n[ \t]*$/, "");
}
