# CLAUDE.md

Personal homepage (mlz.no) — a static site with no build step. Everything in
`public/` is served as-is via Firebase Hosting.

## The project

- Bun (version pinned in `mise.toml`) is the package manager/runner — not
  npm/yarn.
- Biome for lint and format (`bun run lint`, `bun run format`).
- A pre-commit hook (`.githooks/pre-commit`) runs `bun run lint` — don't
  bypass it with `--no-verify`.
- No server, no client-side router: every page is its own `.html` file.
- URLs are extension-less (`cleanUrls: true` in `firebase.json`), so link to
  `/projects/<slug>`, never `/projects/<slug>.html`.

## Generated content

`public/projects/**`, `public/assets/figures/**` and `public/sitemap.xml` are
**generated** by `bun run build:content` from `content/`, and the output is
committed. Never hand-edit those files — edit `content/site.json`,
`content/projects/<slug>.json` or `content/figures/<name>.svg`, then run
`bun run build:content`. `bun run lint` also runs `check:content`, which fails
if the committed output no longer matches `content/`.

The generator lives under `scripts/generator/` (not to be confused with
`content/`, which is the data it reads). Which file you want depends on what
you're changing:

| File | Owns |
| --- | --- |
| `content-schema.js` | the spec every file under `content/` is validated against |
| `render.js` | content in, finished page strings out — no filesystem access |
| `bento.js` | which tile is how wide on the overview grid, per breakpoint |
| `html.js` | the `html\`\`` template engine the renderers are written with |
| `build-content.js` | reading `content/`, writing `public/`, `--check` |
| `tokens.js` | the palette, parsed out of `public/css/tokens.css` |
| `check-links.js` | every link the output emits resolves to a real file |
| `paths.js` | `content/` and `public/`, resolved once |

`content/` has a spec: `scripts/generator/content-schema.js`, doc comments and
all — there's no separate prose copy to keep in sync. The build validates
every file against it before rendering anything, and **a key that isn't in
the spec is an error** — that's the point of it. So adding a field to the
site is two edits in this order: describe it in
`scripts/generator/content-schema.js`, then render it in
`scripts/generator/render.js`. Renderers downstream of validation assume
the shape the spec guarantees and don't re-check it.

Each source file has a `*.test.js` beside it, all run under `bun run test`
(also run by `bun run lint`), each covering the part of the pipeline that
fails silently without it: `content-schema.test.js` exercises the spec's own
cross-file checks against fixtures, so a regression there fails independently
of whatever happens to be in `content/` at the time; `html.test.js` pins the
template engine's indentation and empty-value rules, which otherwise only show
up as a committed file that looks slightly wrong; `render.test.js` renders
fixtures covering every block type and asserts escaping, ordering and optional
fields; `bento.test.js` checks exhaustively — every mix of sizes up to six
tiles — that each grid row is filled exactly and no tile is narrower than its
breakpoint allows, which is the failure a hole in the grid would otherwise only
show as a gap on the page; `tokens.test.js` also pins the two files under
`public/` that carry a hand-written copy of the palette. Add a source file, add
its test file.

A project's `size` is what its tile **asks for**, not a column count.
`scripts/generator/bento.js` cuts the run of tiles into rows and shares each
row's six columns out in proportion to the asking, so a row always fills
exactly whatever mix of sizes `content/` contains — the answer is a
`b-lg-<n> b-md-<n>` class per tile, and `public/css/bento.css` only turns that
into `grid-column`. Two consequences worth knowing before you change either:

- Nothing in `render.js` may branch on `size`. The same tile is a different
  width at each breakpoint and only CSS knows which, so every tile carries its
  whole content and the stylesheet drops what does not fit — a cover figure on
  a tile under half the grid, for instance, which `bento.js` marks `-compact`.
- The spans cannot be inline styles (`firebase.json`'s CSP has no
  `'unsafe-inline'`) and cannot be left to `grid-auto-flow: dense`, which fills
  holes by reordering tiles out of step with the tab order. Hence the class.

After validation, `scripts/generator/check-links.js` checks that every
root-relative `href`/`src`/`og:image` the generated pages emit resolves to a
real file in `public/` — catching a typo in `ogImage`, a stylesheet name, or
similar before it ships as a silent broken link. It runs on the finished
output rather than on `content/`, because the typo is as likely to be in
`render.js`'s own hardcoded markup as in a content file.

The site itself still has no build step: `public/` is deployed exactly as it
sits on disk. The generator only removes duplication between the bento tile,
the case study, the `<head>` tags and the sitemap.

Figures are one SVG per diagram with `{{token}}` colour placeholders; the
generator writes a `-light` and a `-dark` file from the CSS custom properties
in `public/css/tokens.css`, because an SVG loaded via `<img>` cannot see the
page's `[data-theme]`. `content/site.json` carries no colour data — every
colour on the site, figures included, has one source of truth.

The topbar and footer are generated from one function in
`scripts/generator/render.js`, for every page. Generated pages embed it;
`public/index.html` and `public/404.html` — which are otherwise hand-written —
receive it spliced into their `<!-- generated:topbar -->` and
`<!-- generated:footer -->` regions. So **don't hand-edit anything between
those markers**: change the renderer instead and run `bun run build:content`.
`check:content` compares those two files byte-for-byte like any other output,
so an edit inside a region — or a deleted marker — fails CI rather than
quietly diverging from the generated pages.
- All hardening (CSP, HSTS, cache-control) is declared in `firebase.json`,
  not in code. The `headers` list there is last-match-wins — be careful with
  ordering.
- Deploys happen automatically once CI passes on `main`
  (`.github/workflows/deploy.yml` triggers on CI's `workflow_run`, never on
  the push itself). Don't push/merge to `main` unless the user has asked for
  it.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):
`type: short description`, e.g. `fix: ...`, `feat: ...`, `chore: ...`,
`docs: ...`, `release: ...`. See `git log` for examples from this repo.

## Pull requests

Always use the template in `.github/pull_request_template.md` when opening a
PR — don't write a free-form description. Double-check the checklist items
actually match this repo (e.g. it's `bun run lint`, not `npm run ...`, and
there's no changesets/CONTRIBUTING.md flow here yet) before filling it in.

## CI

`scripts/smoke.sh <base-url>` holds every assertion about a running
deployment: security headers, cache policy, `cleanUrls`, the custom 404 page,
and a byte-for-byte comparison of every file in `public/` against what the
deployment serves. It runs twice, and it is one script so the two can't
drift:

- `ci.yml` boots the Hosting emulator and runs it against that, so
  `firebase.json` is verified in practice and not just parsed. Test changes to
  `firebase.json` or `public/404.html` here.
- `deploy.yml`'s `verify` job runs it against `https://mlz.no` after
  deploying, because `firebase deploy` succeeding only means the upload was
  accepted. Run it locally the same way: `scripts/smoke.sh https://mlz.no`.

Nothing reaches production without CI: `deploy.yml` is triggered by CI
concluding successfully, and its one manual entry point
(`workflow_dispatch`) refuses a commit that has no passing CI run.
