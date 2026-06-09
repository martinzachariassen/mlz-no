# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software
developer based in Oslo.

## Stack

- Static HTML/CSS, no build step, no dependencies
- Editorial monospace layout on a paper background — Space Mono +
  Architects Daughter (with Instrument Serif and Space Grotesk available as
  alternate name treatments via `data-font` on `<html>`)
- Low-chroma accent palettes (`data-accent` on `<html>`) — cyan by default
- Drifting CSS-animated marks behind the hero; honours
  `prefers-reduced-motion`
- [Umami](https://umami.is) for privacy-first analytics
- nginx on [Railway](https://railway.app) for hosting

## Local development

Node version is pinned in `mise.toml`. Start a local static preview with:

```bash
mise run dev
```

Then open <http://127.0.0.1:4173>. You can also open `public/index.html`
directly in a browser when you don't need a local server.

Run the local static checks with:

```bash
mise run check
```

## Deployment

The site deploys automatically to Railway on every push to `main`. Railway
detects the `Dockerfile`, builds an nginx:alpine image, and serves the
static files from `public/`.

### Custom domain

Set under **Settings → Networking** in the Railway dashboard. SSL is handled
automatically.

## Files served from `public/`

- `index.html` — the homepage
- `404.html` — error page (nginx serves this for any 404)
- `styles.css` — all page styles (shared between `index.html` and `404.html`)
- `favicon.svg`, `favicon.ico`, `favicon-32.png`, `favicon-192.png` — favicon
  set, also referenced as PWA icons from `site.webmanifest`
- `apple-touch-icon.png` — 180×180 iOS home-screen icon
- `site.webmanifest` — PWA manifest (name, theme colour, icons)
- `og.png` — 1200×630 Open Graph card
- `twitter-card.png` — 1200×675 Twitter / X card
- `robots.txt`, `sitemap.xml`

`scripts/check-site.js` (run via `mise run check`) verifies that every file
above exists and that every local `href`/`src` referenced from
`index.html`/`404.html` resolves.

## Design knobs

Both pages set defaults on `<html>` via data attributes that the CSS reads:

- `data-font` — `hand` (default), `grotesk`, `mono`, `serif`
- `data-case` — `upper` (default), `title`, `lower`
- `data-accent` — `cyan` (default), `blue`, `green`, `rust`, `ink`
- `data-motion` — `subtle` (default; halves the marks), `off` (hides them)

Change them in the markup to retune without touching CSS.
