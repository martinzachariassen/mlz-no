# mlz brand

The baseline for everything Martin Zachariassen builds: colours, type, logo,
shape and motion. [mlz.no](https://mlz.no) uses these exact files, so the site
is the reference rendering.

- Guide (this file): <https://mlz.no/brand/BRAND.md>
- Manifest of every file and URL: <https://mlz.no/brand/brand.json>
- Tokens (source of truth, W3C Design Tokens): <https://mlz.no/brand/tokens.json>
- Source: [`public/brand/`](https://github.com/martinzachariassen/mlz-no/tree/main/public/brand)
  in `martinzachariassen/mlz-no`

**Don't invent colours, fonts or logo variants.** If something is missing, add
it to `tokens.json` in the source repo rather than to a single project.

## For AI agents and other repos

Paste this into a project's `CLAUDE.md`, `AGENTS.md` or README:

```md
Brand: follow https://mlz.no/brand/BRAND.md. Tokens: https://mlz.no/brand/tokens.json
(hex lookup: https://mlz.no/brand/brand.json). Logos: https://mlz.no/brand/logo/.
Don't invent colours or fonts. Use the CSS variables / Tailwind classes from the brand files.
```

## Quick start

### Plain CSS (live)

```html
<link rel="stylesheet" href="https://mlz.no/brand/tokens.css" />
```

This gives you the `@font-face` rules (fonts load from mlz.no, CORS-enabled)
and the variables in the table below. Then use them:

```css
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono);
}
```

Files under `/brand/` are cached for an hour, so a change to the baseline
reaches every live consumer the same day.

### Pin a version

Live is the default. To freeze a project on a known version, use the git tag
through jsDelivr (it also sends CORS headers, so the fonts work):

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/martinzachariassen/mlz-no@brand-v1.0.0/public/brand/tokens.css"
/>
```

Any file works the same way: replace `https://mlz.no/brand/` with
`https://cdn.jsdelivr.net/gh/martinzachariassen/mlz-no@brand-vX.Y.Z/public/brand/`.
The current version is in `brand.json` → `version`.

### Tailwind CSS v4

Tailwind can't process `@theme` from a remote URL, so vendor the preset and
re-run the `curl` whenever you want the latest baseline:

```sh
curl -o src/mlz-brand.css https://mlz.no/brand/tailwind.css
```

```css
@import "tailwindcss";
@import "./mlz-brand.css";
```

You get `bg-bg`, `text-fg`, `text-fg-secondary`, `text-fg-muted`,
`border-border`, `text-accent-deep`, `font-mono`, `font-display`,
`rounded-brand`, `ease-brand`, and a `dark:` variant that follows
`data-theme="dark"` (see [Theme](#theme)). Colours are CSS variables
underneath, so switching theme needs no `dark:` classes at all.

### JavaScript / native / anything else

```js
const brand = await (await fetch("https://mlz.no/brand/brand.json")).json();
brand.colors.dark.bg; // "#151619"
```

`brand.json` has hex values per theme, font file URLs and every logo file.
`tokens.json` has the full source in
[DTCG](https://www.designtokens.org/tr/drafts/format/) format (OKLCH plus hex)
for token tools such as Style Dictionary.

## Colour

Two themes, light and dark, defined in OKLCH. The hues are a cool blue-grey
neutral (250 light, 265 dark) and one violet accent (285).

<!-- tokens:start -->
| Token | Light | Dark | Contrast on bg (light / dark) | Use |
| --- | --- | --- | --- | --- |
| `--bg` | `#ebeff2` · `oklch(0.95 0.006 250)` | `#151619` · `oklch(0.2 0.006 265)` | — / — | Page background. |
| `--fg` | `#101214` · `oklch(0.18 0.006 250)` | `#e9ebef` · `oklch(0.94 0.006 265)` | 16.2:1 / 15.2:1 (text, ≥ 4.5 enforced) | Primary text, the logo mark, button borders. |
| `--fg-secondary` | `#3b3d40` · `oklch(0.36 0.006 250)` | `#b5b7bb` · `oklch(0.78 0.006 265)` | 9.4:1 / 9.0:1 (text, ≥ 4.5 enforced) | Secondary text: eyebrows, footers, captions. |
| `--fg-muted` | `#5c6166` · `oklch(0.49 0.01 250)` | `#8f9299` · `oklch(0.66 0.01 265)` | 5.4:1 / 5.8:1 (text, ≥ 4.5 enforced) | Quiet UI: icon buttons at rest, hints. |
| `--border` | `#caced3` · `oklch(0.85 0.008 250)` | `#2e3034` · `oklch(0.31 0.008 265)` | 1.4:1 / 1.4:1 | Hairlines and dividers. Decorative, not for text. |
| `--accent` | `#968dfd` · `oklch(0.7 0.16 285)` | `#968dfd` · `oklch(0.7 0.16 285)` | 2.4:1 / 6.5:1 | Decorative violet: selection tint, glitch shadows. Never for text in light. |
| `--accent-deep` | `#4d4691` · `oklch(0.44 0.12 285)` | `#a29aff` · `oklch(0.74 0.16 285)` | 7.0:1 / 7.4:1 (text, ≥ 4.5 enforced) | Violet for text-weight accents: the period in “mlz.”, separators, hover shadows, focus rings. |
| `--glitch-2` | `#c94c18` · `oklch(0.58 0.17 40)` | `#ec6d3d` · `oklch(0.68 0.17 40)` | 4.0:1 / 5.9:1 | Warm counterpart to accent, only in the glitch effect. |
<!-- tokens:end -->

Rules:

- The page is neutral; the accent is a **detail**: the period in “mlz.”,
  separators, hover shadows, focus rings, the selection tint.
- `--accent-deep` is the accent for anything that must be read or seen as a
  line (text, borders, outlines, shadows). `--accent` is decorative only:
  never text in the light theme.
- `--glitch-2` exists only for the glitch effect. Don't use it as a second
  accent.
- Text uses `--fg`, `--fg-secondary` or `--fg-muted`; all three pass WCAG AA
  (≥ 4.5:1) on `--bg` in both themes, and the generator refuses tokens that
  don't. `--border` is for hairlines, never text.
- Tints are mixed from tokens instead of new colours, e.g.
  `color-mix(in oklch, var(--fg) 9%, transparent)` for a hover background or
  `color-mix(in oklch, var(--accent) 30%, transparent)` for `::selection`.

## Theme

The dark values apply when `<html data-theme="dark">`. Set the attribute
before first paint from the stored choice, else the system preference, so
there's no flash. mlz.no's
[`theme-init.js`](https://github.com/martinzachariassen/mlz-no/blob/main/public/theme-init.js)
is the reference: a blocking script in `<head>` that sets `data-theme`, keeps
`<meta name="theme-color">` in sync (`#ebeff2` light, `#151619` dark) and
stores an explicit choice in `localStorage.theme`. Without any script the
page stays light.

## Typography

| Role | Face | Settings |
| --- | --- | --- |
| Display: names, headlines | Newsreader, italic | `var(--font-display)`, weight 500, `font-variation-settings: "opsz" 72`, line-height ~0.96 |
| Everything else: body, UI | IBM Plex Mono 400 | `var(--font-mono)` |
| Wordmark “mlz.” | IBM Plex Mono 700 | `letter-spacing: -0.03em`, the period in `--accent-deep` |
| Labels, eyebrows, buttons | IBM Plex Mono 400, uppercase | 10–13px, `letter-spacing` 0.14em (buttons) to 0.32em (eyebrows) |

Newsreader ships italic only (variable, 200–800); Plex Mono ships 400 and
700. Both are under the SIL Open Font License (see `fonts/`).

## Shape and motion

- Radius: `var(--radius)` (4px) on buttons and boxes. Nothing rounder.
- Borders: `1.5px solid var(--fg)` for controls, `1px solid var(--border)`
  for dividers.
- Hover on a control: a hard offset shadow `5px 5px 0 0 var(--accent-deep)`,
  no blur. Gate hover styles in `@media (hover: hover)`.
- Focus: `outline: 2px solid var(--accent-deep); outline-offset: 2px`.
- One easing curve for everything: `var(--ease)`,
  `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- Entrances: “rise”, 0.9s, from `opacity: 0; translateY(8px)`, staggered.
- Respect `prefers-reduced-motion: reduce` by cutting animations and
  transitions to ~0.

## Logo

The mark is an M cut out of a rounded square (32 × 32 grid, radius 6).
The cut-out is transparent, so the mark works on any background.

| File | Use |
| --- | --- |
| [`logo/mark.svg`](https://mlz.no/brand/logo/mark.svg) | Default. Follows the viewer's colour scheme. |
| [`logo/mark-dark.svg`](https://mlz.no/brand/logo/mark-dark.svg) | Dark mark for light backgrounds. |
| [`logo/mark-light.svg`](https://mlz.no/brand/logo/mark-light.svg) | Light mark for dark backgrounds. |
| `logo/png/mark-{dark,light}-{64,256,512,1024}.png` | Raster mark, transparent background. |
| `logo/png/lockup-{dark,light}@2x.png` | Mark + “mlz.” wordmark, transparent background. |

Inline, as on mlz.no, so it follows the page theme:

```html
<svg viewBox="0 0 32 32" width="16" height="16" role="img" aria-label="MLZ">
  <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--fg)" />
  <polygon points="7,25 7,7 11.5,7 16,18.5 20.5,7 25,7 25,25" fill="var(--bg)" />
</svg>
```

Rules:

- Colour is `--fg` only: dark on light, light on dark. Never the accent,
  never a gradient.
- Minimum size 16px. Keep clear space of at least 25% of the mark's width on
  every side.
- Don't stretch, rotate, outline, add effects or recolour it.
- Lockup: the mark, then “mlz.” in Plex Mono 700 (`letter-spacing: -0.03em`,
  the period in `--accent-deep`), vertically centred. Proportions: font size
  0.85 × the mark, gap 0.4 × the mark (mark 40px → text 34px, gap 16px). An
  SVG wordmark isn't available yet; use the PNG lockup or set the text live.

## Changing the baseline

In `martinzachariassen/mlz-no`:

1. Edit `public/brand/tokens.json` (OKLCH components).
2. Run `bun run brand`. It fills in hex, checks contrast, and regenerates
   `tokens.css`, `tailwind.css`, `brand.json`, the logo SVGs and the table
   above. CI fails if they're out of date. If `fg` or the mark changed, also
   run `bun run brand:png` (macOS + Chrome) to re-render the PNGs.
3. Bump `$extensions["no.mlz"].version` in `tokens.json` for a breaking or
   visible change, merge, then tag `brand-vX.Y.Z` for pinned consumers.
