# mlz.no

[![CI](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)

Martin Zachariassen's personal homepage — live at [mlz.no](https://mlz.no).

## How the site works

A single static page with no build step. `public/` is deployed exactly as it
is, by Firebase Hosting.

- `public/index.html` is the page. Its styles are split by section in
  `public/css/` (base, topbar, hero, buttons, footer, motion).
- Three small scripts in `public/js/` add the colour-theme toggle, the glitch
  effect (occasional character flicker, off for reduced-motion) and the year
  in the footer. `public/theme-init.js` runs
  first and applies the saved theme before first paint, so there is no flash.
- Colours, fonts and the logo come from the design tokens in
  [`public/brand/`](public/brand/BRAND.md). `index.html` links
  `public/brand/tokens.css` directly.
- There is no server and no client-side router. Every page is a real `.html`
  file at a fixed path, and `public/404.html` is served as an actual 404 for
  anything else.

Because nothing runs per request, all hardening — CSP, HSTS, cache-control —
is declared in [`firebase.json`](firebase.json) rather than in code.

## Requirements

- [Bun](https://bun.sh), version pinned in [`mise.toml`](mise.toml). Install it
  via [mise](https://mise.jdx.dev) or install Bun yourself and match the
  version.
- The Firebase CLI is a devDependency, so it needs no separate install.

## Getting started

```sh
bun install
bun run dev     # serves public/ through the Firebase Hosting emulator
```

```sh
bun run lint    # biome ci .
bun run format  # biome check --write .
```

`bun install` also wires up a pre-commit hook that runs `bun run lint`.

## Headers and cache policy

`firebase.json` is the only place the response headers can live, and its
`headers` list is last-match-wins, so reordering it can silently break a rule.
`scripts/verify.sh` boots the Hosting emulator and checks that the security
headers, cache policy and custom 404 actually take effect. Run it after any
change to `firebase.json` or `public/404.html`:

```sh
./scripts/verify.sh
```

## Design tokens

`public/brand/tokens.json` is the single source for the site's colours, fonts
and logo. Edit it, then:

```sh
bun run brand        # fill in hex, check contrast, regenerate the rest
bun run brand:png    # re-render the logo PNGs (macOS + Chrome), if fg or the mark changed
```

`tokens.css`, `tailwind.css`, `brand.json`, the logo SVGs and the colour table
in `BRAND.md` are generated and committed — don't edit them by hand. CI runs
`bun run brand:check` to catch drift. The files are served under `/brand/`, so
their URLs are a public contract: don't rename or remove them without a
version bump (`brand-vX.Y.Z`, see [`BRAND.md`](public/brand/BRAND.md)).

## Social card

`public/assets/social/og.png` (the 1200×630 Open Graph image) is rendered from
[`tools/og/og.html`](tools/og/og.html) using the site's tokens and fonts (light
theme). Regenerate it whenever those change:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 &   # serve the repo root
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --hide-scrollbars --window-size=1200,630 --force-device-scale-factor=1 \
  --virtual-time-budget=4000 --screenshot=public/assets/social/og.png \
  http://127.0.0.1:8765/tools/og/og.html
kill %1
```

LinkedIn and others cache the card for days. Use LinkedIn's Post Inspector to
make them fetch the new one.

## Deploys

- Every same-repo PR gets a preview channel (`preview.yml`) that expires after
  7 days.
- Every push to `main` deploys to production (`deploy.yml`) after the same
  checks CI runs. It authenticates to Google Cloud through Workload Identity
  Federation, so the repo holds no long-lived secrets.
- A weekly job (`gcp-auth-check.yml`) catches a broken login before the next
  deploy does.

## Infrastructure

The GCP project, Firebase Hosting, the custom domain, the deploy login and the
GitHub repository settings are Terraform in [`infra/`](infra/README.md),
applied by hand. CI only checks `fmt` and `validate`.

## Contributing

This is a personal site, so I'm not looking for new features. Bug reports and
small fixes are welcome as an issue or PR.

## License

[MIT](LICENSE)
