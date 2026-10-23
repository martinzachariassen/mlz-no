# mlz.no

[![CI](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)

Martin Zachariassen's personal homepage — live at [mlz.no](https://mlz.no).

> **Looking for the brand (colours, fonts, logo)?** This repo is the mlz brand
> baseline: start at [`public/brand/BRAND.md`](public/brand/BRAND.md), live at
> [mlz.no/brand](https://mlz.no/brand/BRAND.md).

A static site with no build step: plain HTML, CSS, and JS in `public/`,
served as-is by Firebase Hosting.

## Features

- No build step — the files in `public/` are exactly what gets deployed
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
bun run lint    # biome ci .
bun run format  # biome check --write .
```

A pre-commit hook (wired up by `bun install` via the `prepare` script) runs
`bun run lint` before each commit.

## Architecture

There's no server and no client-side router — every page is a real `.html`
file at a fixed path, and `public/404.html` is served as an actual 404 for
anything else. Because nothing executes per request, all hardening (CSP,
HSTS, cache-control) is configured declaratively in `firebase.json` rather
than in code.

CI (`.github/workflows/ci.yml`) boots the Hosting emulator and asserts that
those headers and cache rules actually take effect — `firebase.json`'s
`headers` list is last-match-wins, so a reorder could silently break a rule.
Deploys (`.github/workflows/deploy.yml`) run on every push to `main`,
authenticating to Google Cloud via Workload Identity Federation — no
long-lived secrets stored in the repo.

## Brand baseline

This repo is also the source of the mlz brand — colours, fonts, logo and
rules — that other projects link to live at
[mlz.no/brand](https://mlz.no/brand/BRAND.md). Everything lives in
[`public/brand/`](public/brand/BRAND.md), and the site uses the same files.

`public/brand/tokens.json` is the single source. Edit it, then:

```sh
bun run brand        # fill in hex, check contrast, regenerate the rest
bun run brand:png    # re-render the logo PNGs (macOS + Chrome), if fg or the mark changed
```

The generated files (`tokens.css`, `tailwind.css`, `brand.json`, the logo
SVGs, the colour table in `BRAND.md`) are committed, and CI runs
`bun run brand:check` to catch drift. Tag `brand-vX.Y.Z` for projects that pin
a version via jsDelivr.

## Social card

`public/assets/social/og.png` (the 1200×630 Open Graph image) is rendered
from [`tools/og/og.html`](tools/og/og.html), which uses the brand tokens and
fonts (light theme). Regenerate it whenever those change:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 &   # serve the repo root
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --hide-scrollbars --window-size=1200,630 --force-device-scale-factor=1 \
  --virtual-time-budget=4000 --screenshot=public/assets/social/og.png \
  http://127.0.0.1:8765/tools/og/og.html
kill %1
```

LinkedIn and others cache the card for days. Use LinkedIn's Post Inspector
to make them fetch the new one.

## Contributing

This is a personal site, not a project soliciting new features — but bug
reports and small fixes are welcome via issue or PR.

## License

[MIT](LICENSE)
