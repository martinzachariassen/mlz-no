# mlz.no

[![CI](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)

Martin Zachariassen's personal homepage — live at [mlz.no](https://mlz.no).

A static site with no build step: plain HTML, CSS, and JS in `public/`,
served as-is by Firebase Hosting.

## Features

- No build step — the files in `public/` are exactly what gets deployed
- A projects section with per-project case studies, written as JSON in
  `content/` and generated into `public/`
- Dark/light theme toggle and a glitch effect
- Security headers (CSP, HSTS, and friends) and cache policy defined in
  [`firebase.json`](firebase.json), the only place that config can live for a
  purely static site

## Requirements

- [Bun](https://bun.sh), version pinned in [`mise.toml`](mise.toml) — install
  via [mise](https://mise.jdx.dev), or install Bun yourself and match the
  version
- The Firebase CLI is pulled in as a devDependency, so no separate install is
  needed

## Getting started

```sh
bun install
bun run dev     # serves public/ via the Firebase Hosting emulator
```

```sh
bun run lint    # biome ci . + check that generated content is in sync
bun run format  # biome check --write .
```

## Writing a project

Projects live in `content/`, not in `public/`. Add or edit
`content/projects/<slug>.json` (and any `content/figures/<name>.svg`
diagram), then:

```sh
bun run build:content
```

That writes `public/projects/**`, `public/assets/figures/**` and
`public/sitemap.xml`, which are committed alongside the JSON. Those generated
files should never be hand-edited — `bun run lint` fails if they drift from
`content/`.

[`scripts/content/content-schema.js`](scripts/content/content-schema.js) is
the guide to writing that input — the pipeline, every field, every block
type, every figure rule — and enforces it in the same place: the build
validates every file before rendering anything, and a key that isn't in the
spec is an error rather than something quietly ignored.

The site still has no build step: `public/` is deployed exactly as it sits on
disk, and nothing is generated at request time. The generator exists so a
project's prose lives in one place instead of being repeated across the
overview tile, the case study, the `<head>` tags and the sitemap.

A pre-commit hook (wired up by `bun install` via the `prepare` script) runs
`bun run lint` before each commit.

## Architecture

There's no server and no client-side router — every page is a real `.html`
file at a fixed path, and `public/404.html` is served as an actual 404 for
anything else. `cleanUrls` hides the `.html` suffix, so `/projects/<slug>` is
the canonical URL and the `.html` form redirects to it. Because nothing
executes per request, all hardening (CSP, HSTS, cache-control) is configured
declaratively in `firebase.json` rather than in code.

That CSP has no `unsafe-inline`, which shapes the markup: no inline
`<style>`, no `style="…"`, no inline `<script>` and no `onclick`. Entrance
delays and the bento stagger are CSS classes rather than inline styles for
that reason.

CI (`.github/workflows/ci.yml`) boots the Hosting emulator and asserts that
those headers and cache rules actually take effect — `firebase.json`'s
`headers` list is last-match-wins, so a reorder could silently break a rule.
Deploys (`.github/workflows/deploy.yml`) run on every push to `main`,
authenticating to Google Cloud via Workload Identity Federation — no
long-lived secrets stored in the repo.

## Contributing

This is a personal site, not a project soliciting new features — but bug
reports and small fixes are welcome via issue or PR.

## License

[MIT](LICENSE)
