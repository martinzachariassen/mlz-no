# mlz.no

[![CI](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)

Martin Zachariassen's personal homepage — live at [mlz.no](https://mlz.no).

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

## Social card

`public/assets/social/og.png` (the 1200×630 Open Graph image) is rendered
from [`tools/og/og.html`](tools/og/og.html), which uses the site's own fonts
and light-theme colours. Regenerate it whenever those change:

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
