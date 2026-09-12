# Writing content

Everything under `content/` is input to `scripts/build-content.js`, which writes
the projects section of the site into `public/`. This file explains how that
works and how to write the input: what each file is for, every key it may
contain, what each one renders, and what the build refuses to accept.

You never hand-edit anything under `public/projects/`,
`public/assets/figures/` or `public/sitemap.xml`. Those are output.

- [The short version](#the-short-version)
- [How the build works](#how-the-build-works)
- [Adding a project, start to finish](#adding-a-project-start-to-finish)
- [`site.json`](#sitejson)
- [`projects/<slug>.json`](#projectsslugjson)
- [Blocks](#blocks)
- [Figures](#figures)
- [When the build says no](#when-the-build-says-no)
- [Changing the spec itself](#changing-the-spec-itself)
- [Rules the generator lives by](#rules-the-generator-lives-by)

## The short version

```
content/
  site.json              settings and copy shared by every generated page
  projects/<slug>.json   one case study, one tile on the overview grid
  figures/<name>.svg     one diagram, coloured per theme at build time
```

```sh
bun run build:content   # validate, write the generated files, drop leftovers
bun run check:content   # validate, then fail if what's on disk differs
bun run dev             # serve public/ through the Firebase Hosting emulator
```

Edit a file under `content/`, run `bun run build:content`, and commit the
input and the generated output together. `bun run lint` runs `check:content`,
and so does the pre-commit hook, so forgetting the build fails before the
commit lands.

`bun run lint` also runs `bun test scripts`, which exercises
`scripts/content-schema.js` itself — the cross-file checks below (slug and
figure references, palette parity, stray files) — against small fixtures, so
a change to the spec's own logic that quietly stops catching something is
caught too, not just a change to `content/`.

## How the build works

One command, four steps, and it stops at the first step that fails.

1. **Read.** `content/site.json`, every `content/projects/*.json`, every
   `content/figures/*.svg`.
2. **Validate.** All of it goes to `scripts/content-schema.js` at once. Every
   problem in every file is reported together, each one naming the file and the
   path inside it. Nothing is rendered if anything failed.
3. **Render.** The renderers assume the shape the spec guarantees and do not
   re-check it.
4. **Write** (or, with `--check`, compare and fail on any difference).

What comes out, and what it is made from:

| Output                                     | Built from                                    |
| ------------------------------------------ | --------------------------------------------- |
| `public/projects/index.html`               | `site.json` plus every project's tile fields  |
| `public/projects/<slug>.html`              | `projects/<slug>.json` plus `site.json`       |
| `public/assets/figures/<name>-light.svg`   | `figures/<name>.svg` + `palette.light`        |
| `public/assets/figures/<name>-dark.svg`    | `figures/<name>.svg` + `palette.dark`         |
| `public/sitemap.xml`                       | `site.json` origin and sitemap block, and each project's `lastmod` |

The generator exists to remove duplication, not to add a build step. The site
has no build step: `public/` is deployed exactly as it sits on disk. A project's
prose would otherwise be copied by hand into the bento tile, the case study, the
`<head>` tags and the sitemap, and would drift in three of the four.

The one rule behind the whole spec: **a key that is not in the spec is an
error, not something to ignore.** Without that, a typo is invisible. A
misspelled key silently does nothing, and a field the generator stopped reading
lives on in the JSON looking meaningful.

## Adding a project, start to finish

1. **Pick the slug.** The filename is the URL:
   `content/projects/event-pipeline.json` becomes `/projects/event-pipeline`.
   Lowercase kebab-case, and the `slug` inside the file must match the filename.
2. **Draw the cover figure** as `content/figures/<name>.svg`, using `{{token}}`
   placeholders for colours. See [Figures](#figures).
3. **Write the file.** Start from the skeleton below, or copy an existing
   project and replace it section by section.
4. **Pick `order`.** It is the position on the overview grid, unique across
   projects, and also the previous/next order at the foot of each case study.
5. **Run `bun run build:content`** and fix whatever it tells you.
6. **Look at it**: `bun run dev`, then `/projects` and `/projects/<slug>`, in
   both themes.
7. **Commit** `content/` and the generated files under `public/` together.

A minimal project that builds — every required key, one section, one block:

```json
{
  "slug": "my-project",
  "order": 2,
  "size": "normal",
  "name": "My Project",
  "tagline": "One sentence on what it is, used on the tile and under the heading.",
  "period": "2024 — 2025",
  "stack": ["Kotlin", "PostgreSQL"],
  "tags": ["Backend"],
  "status": "In production",
  "lastmod": "2026-09-12",
  "seo": {
    "title": "My Project — Martin Zachariassen",
    "description": "One or two sentences for search results and link previews."
  },
  "cover": {
    "figure": "my-diagram",
    "alt": "What the diagram shows, in a sentence."
  },
  "summary": "A paragraph above the first section: the problem, the decision, the outcome.",
  "sections": [
    {
      "label": "Problem",
      "heading": "What was actually wrong",
      "blocks": [{ "type": "text", "value": "A paragraph." }]
    }
  ]
}
```

Add `role` and `team` to that and they appear in the facts list. Everything
else is either required or a [block](#blocks) inside `sections`.

## `site.json`

Settings and copy shared by every generated page. One object, no optional keys.

### Identity and analytics

| Key              | Shape                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `origin`         | `https://host`, no trailing slash — everything else is appended to it |
| `author`         | text, used in `og:site_name` and as the JSON-LD author             |
| `locale`         | `xx_XX`, e.g. `en_GB`                                              |
| `umamiWebsiteId` | UUID for the analytics script                                      |
| `ogImage`        | root-relative path to the social image, no trailing slash          |

### Paths

| Key         | Shape                                                             |
| ----------- | ----------------------------------------------------------------- |
| `basePath`  | root-relative path — the projects index lives here, and each project at `<basePath>/<slug>` |
| `figureDir` | root-relative path under `public/` where the themed SVGs are written |

Both are root-relative with no trailing slash, because they are concatenated
rather than joined. URLs are extension-less on this site, so a link is
`/projects/<slug>`, never `/projects/<slug>.html`.

### `palette`

`light` and `dark`, each a map of token name → six-digit lowercase hex.

```json
"palette": {
  "light": { "bg": "#ebeff2", "fg": "#101214", "accent": "#968dfd" },
  "dark":  { "bg": "#151619", "fg": "#e9ebef", "accent": "#968dfd" }
}
```

- Both themes must define **exactly the same token names**. A token present in
  one theme only would render that figure with a literal `{{token}}` in the
  other, and the build rejects it.
- A `bg` token is required in practice: the generated `<head>` uses
  `palette.light.bg` and `palette.dark.bg` for the `theme-color` meta tags.
- These are the colours figures are painted with. They are deliberately a
  mirror of the CSS custom properties in `public/css/tokens.css`, not a
  replacement for them — an SVG loaded through `<img>` cannot read the page's
  custom properties, so the values have to exist on both sides.

### `sitemap`

```json
"sitemap": {
  "home":    { "lastmod": "2026-07-26", "changefreq": "monthly", "priority": "1.0" },
  "index":   { "lastmod": "2026-09-12", "changefreq": "monthly", "priority": "0.8" },
  "project": { "changefreq": "yearly", "priority": "0.6" }
}
```

`home` and `index` each carry their own date. `project` carries only the
`changefreq` and `priority` shared by every case study — each project brings its
own `lastmod`. `changefreq` is one of the sitemap vocabulary values
(`always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`); `priority` is a
string from `"0.0"` to `"1.0"`, one decimal.

Dates are content rather than clock readings on purpose. `public/sitemap.xml`
is committed, so a build-time "today" would put the build out of date with
itself the next morning and fail `check:content` on a day nobody had touched
anything.

### `index`

The copy on the projects overview page.

| Key           | Renders as                                            |
| ------------- | ----------------------------------------------------- |
| `title`       | `<title>` and `og:title` — 60 characters or fewer      |
| `description` | meta description, `og:description`, JSON-LD — 160 characters or fewer |
| `eyebrow`     | the small kicker above the heading                    |
| `heading`     | the `<h1>`                                            |
| `intro`       | the paragraph under it                                |
| `asideTiles`  | non-project cards on the grid, may be `[]`            |

An aside tile takes `size`, `label`, `title`, `text`, `cta`, `href` and
`umamiEvent`. Its `href` must be an `http(s)://` or `mailto:` link: these tiles
are for going off-site, and they render with `target="_blank"` and a `↗`.
`umamiEvent` is the analytics event name, kebab-case. Project tiles do not
need one — they get `project-<slug>` automatically.

## `projects/<slug>.json`

| Key        | Shape                                                            |
| ---------- | ---------------------------------------------------------------- |
| `slug`     | lowercase kebab-case, matching the filename, unique              |
| `order`    | integer ≥ 1, unique — position on the grid, and previous/next order |
| `size`     | `flagship` (full width), `wide` (¾) or `normal` (½)              |
| `name`     | project title — the tile title and the `<h1>`                    |
| `tagline`  | one sentence, on the tile and under the case study heading       |
| `period`   | free text, e.g. `2023 — 2025`                                    |
| `role`     | optional, shown in the facts list                                |
| `team`     | optional, shown in the facts list                                |
| `stack`    | list of technologies; joined with `·` on the tile and in the facts, and the first one appears in the page eyebrow |
| `tags`     | list of topics, rendered as the tag row and as JSON-LD keywords  |
| `status`   | free text, e.g. `In production` — on the tile and in the facts   |
| `lastmod`  | `YYYY-MM-DD`, this page's sitemap date                           |
| `seo`      | `title` (≤60 chars) and `description` (≤160 chars) for `<head>` |
| `cover`    | `figure`, `alt`, optional `caption`                              |
| `summary`  | a paragraph, above the first section                             |
| `sections` | the body — see below                                             |

`size` values are the `.b-*` classes `public/css/bento.css` defines. A size the
stylesheet has no rule for would render as a full-width tile with no warning,
which is why the list is closed.

What ends up where:

- **The tile** on `/projects` uses `cover`, `period`, `status`, `name`,
  `tagline` and `stack`.
- **The case study** opens with `period` and `stack[0]` as the eyebrow, then
  `name`, `tagline`, a facts list of `role`, `team`, `status` and `stack`, the
  cover figure, `summary`, then the sections, then `tags`.
- **`<head>`** uses `seo`; **the sitemap** uses `lastmod`.

A section is three keys, and the body is a list of them:

```json
{
  "label": "Problem",
  "heading": "The nightly batch had run out of night",
  "blocks": [ … ]
}
```

`label` is the small kicker above the heading; `heading` is the `<h2>`.

## Blocks

Every block is `{ "type": …, … }`. Seven types, one renderer each, and no way
to reach a block type the renderer does not implement.

Nothing in a block is parsed as Markdown or HTML. Every value is escaped and
rendered as text, so `<`, `&` and quotes are safe to type and a `**bold**` will
show up as asterisks.

### `text`

A paragraph. The block you will use most.

```json
{ "type": "text", "value": "One paragraph. Several sentences are fine." }
```

### `list`

`items` is required. `title` renders as a small heading above the list, and
`kind` is `bulleted` (the default) or `numbered`.

```json
{
  "type": "list",
  "title": "What was actually broken",
  "kind": "bulleted",
  "items": ["One shared failure domain.", "No way to reprocess a subset."]
}
```

### `figure`

A diagram in the flow of the body, in a container that scrolls sideways on a
narrow screen rather than shrinking to an unreadable strip. `figure` is the
filename under `content/figures/` without the `.svg`.

```json
{
  "type": "figure",
  "figure": "throughput",
  "alt": "Line chart: sustained throughput climbing from 4k to 19k events per second after the cutover.",
  "caption": "Optional. A sentence under the diagram."
}
```

### `code`

`language` is the label on the snippet, not a highlighter — there is no syntax
highlighting. `lines` is one string per line, and an empty string is a blank
line inside the snippet.

```json
{
  "type": "code",
  "language": "kotlin",
  "caption": "Optional. What the snippet shows.",
  "lines": ["fun handle(event: Event) {", "", "  store.upsert(event.id, event)", "}"]
}
```

### `metrics`

A row of figures. Each item is `value` and `label`; the value is the big number
and the label is the small caption under it.

```json
{
  "type": "metrics",
  "items": [
    { "value": "7 h → 90 s", "label": "End-to-end latency" },
    { "value": "19k/s", "label": "Sustained throughput" }
  ]
}
```

### `quote`

A pull quote. `attribution` is optional and renders as the citation.

```json
{
  "type": "quote",
  "value": "We did not have a performance problem.",
  "attribution": "From the design review that started the rewrite"
}
```

### `note`

An aside, set apart from the prose. `title` is optional.

```json
{
  "type": "note",
  "title": "On idempotency",
  "value": "Every consumer keys on the event id, so a replay is a no-op."
}
```

## Figures

One `.svg` per diagram, hand-written, referenced by filename without the
extension. The build writes `<name>-light.svg` and `<name>-dark.svg` into
`figureDir`, and the pages swap between them in CSS.

Why two files: an SVG loaded through `<img>` is its own document. It cannot see
the page's custom properties or its `[data-theme]`, so it cannot recolour
itself — the colours have to be baked in, once per theme.

Three rules, all enforced:

- **A `viewBox="0 0 W H"` is required.** That is where the `<img>` gets its
  `width` and `height`, and without them the page reflows as the diagram loads.
- **Colours are `{{token}}` placeholders** naming a key from `palette`. An
  unknown token fails the build, with a guess at which one you meant.
- **Every figure must be referenced** by some project, as a `cover.figure` or a
  `figure` block. An unreferenced one is two committed files in `public/` that
  nothing links to.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 590" role="img">
  <rect width="1600" height="590" fill="{{bg}}" />
  <line x1="64" y1="112" x2="1536" y2="112" stroke="{{border}}" stroke-width="2" />
  <text x="64" y="88" font-size="24" fill="{{fg}}">SUSTAINED THROUGHPUT</text>
</svg>
```

These are wide diagrams, drawn at a fixed coordinate size and scaled down by
the page. Keep type large enough to survive that: a 13px label in a 1600-unit
viewBox is readable, an 8px one is not.

Text inside a figure carries no accessibility weight. The `alt` at the
reference site is what a screen reader gets, so write it to describe what the
diagram shows, not that a diagram exists.

## When the build says no

Everything is validated in one pass, so one run reports every problem rather
than one per run. Each line names the file and the path inside it:

```
content/projects/event-pipeline.json
  size: expected one of "flagship", "wide", "normal", got "flagsip" (did you mean "flagship"?)
  sections[1].blocks[3]: unexpected key "lang" (did you mean "language"?)
```

| Message                                    | What it means                                                        |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `unexpected key "x"`                        | Not in the spec. A typo, or a field that needs adding to the spec first. |
| `missing required key`                      | Optional keys are marked as such in the tables above; this one isn't. |
| `unknown type "x"`                          | Not one of the seven block types.                                     |
| `slug: … does not match the filename`       | The filename is the URL. Rename one to match the other.               |
| `order: 2 is already used by …`             | Two projects want the same position on the grid.                      |
| `no content/figures/x.svg`                  | A `figure` reference with no file behind it.                          |
| `not referenced by any project`             | A figure file nothing points at. Reference it or delete it.           |
| `unknown palette token {{x}}`               | A figure uses a colour `palette` doesn't define.                      |
| `palette.dark: missing token "x"`           | The two themes have drifted apart.                                    |
| `needs a viewBox="0 0 W H"`                 | Add one, or the page reflows as the figure loads.                     |
| `not a .svg file`                           | Something other than a figure landed in `content/figures/` — often a stray `.DS_Store`. Delete it. |
| `search engines truncate this past N characters` | An `seo`/`index` title or description is longer than what shows up in a search result. Shorten it. |
| `Generated pages link to files that don't exist` | A generated `href`/`src`/`og:image` points at a path with nothing behind it in `public/` — a typo in `ogImage`, a stylesheet name, or similar. |
| `Generated files are out of date`           | You edited `content/` without running `bun run build:content`.        |
| `not generated from content/, would be removed` | A leftover file in a generated directory. Usually a renamed slug.  |

The last two are `check:content` rather than validation failures, and they are
what `bun run lint` and the pre-commit hook catch. Run the build and commit the
output; the build deletes the leftovers as part of writing.

## Changing the spec itself

Adding a field to the site is two edits, in this order:

1. Describe it in `scripts/content-schema.js`.
2. Render it in `scripts/build-content.js`.

The other way round means the field is rejected before the renderer ever sees
it. Removing a field is the same in reverse: drop the markup, drop the spec
entry, and the next build tells you which content files still carry it.

A new **block type** is three edits: a shape in the `block` variant in the
schema, a renderer in `blockRenderers` in the build script, and whatever CSS it
needs in `public/css/case-study.css`. A new **tile size** is a value in
`TILE_SIZES` and a matching `.b-*` rule in `public/css/bento.css`.

Keep this file in step with the schema. `scripts/content-schema.js` is the
enforced version of the spec; this one is the readable version, and a spec that
disagrees with itself is worse than one that is merely terse.

## Rules the generator lives by

- **No inline styles or scripts.** `firebase.json`'s CSP has no
  `unsafe-inline`, so the generator never emits an inline `<style>`, a
  `style="…"` attribute, an inline `<script>` or an `onclick`. Anything new
  that needs styling or behaviour gets a class in `public/css/` or a file in
  `public/js/`.
- **Everything is escaped.** Content is text, never markup.
- **The output is committed.** `public/` is deployed exactly as it sits on
  disk, so a build that isn't committed is a change that isn't deployed.
- **`public/projects/` and `public/assets/figures/` belong to the generator.**
  Nothing hand-written lives in either, so the build deletes anything in them
  it didn't just write and `check:content` fails on it. Rename a project and
  the old case study goes away instead of staying live at its old URL.
- **Nothing reads the clock.** Every date in the output comes from `content/`,
  so two builds of the same input are byte-identical.
- **The topbar and footer are copied into every generated page** by the build
  script, and hand-written into `public/index.html` and `public/404.html`. If
  that markup changes, all three have to change together.
