# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software
developer based in Oslo.

## Stack

- Static HTML/CSS, no build step, no runtime dependencies
- Editorial monospace layout on a paper background — Space Mono +
  Architects Daughter (with Instrument Serif and Space Grotesk available as
  alternate name treatments via `data-font` on `<html>`)
- Low-chroma accent palettes (`data-accent` on `<html>`) — cyan by default
- Drifting CSS-animated marks behind the hero; honours
  `prefers-reduced-motion`
- [Umami](https://umami.is) for privacy-first analytics
- Tiny single-file Node static server (`server.js`), hosted on
  [Railway](https://railway.app)

## Local development

Node version is pinned in `mise.toml`. Start a local preview with:

```bash
mise run dev
```

Then open <http://127.0.0.1:4173>. You can also open `public/index.html`
directly in a browser when you don't need a local server.

## Deployment

The site deploys automatically to Railway on every push to `main`. Railway's
Nixpacks builder detects Node via `package.json`, runs `npm start`, and
`server.js` streams files from `public/` on `$PORT`, bound to `::` so the
edge can reach the container over either IPv4 or IPv6.

### Custom domain

Set under **Settings → Networking** in the Railway dashboard. SSL is handled
automatically.

## Files served from `public/`

- `index.html` — the homepage
- `styles.css` — all page styles
- `favicon.svg`, `favicon.ico`, `favicon-32.png`, `favicon-192.png` — favicon
  set, also referenced as PWA icons from `site.webmanifest`
- `apple-touch-icon.png` — 180×180 iOS home-screen icon
- `site.webmanifest` — PWA manifest (name, theme colour, icons)
- `og.png` — 1200×630 Open Graph card
- `twitter-card.png` — 1200×675 Twitter / X card
- `robots.txt`, `sitemap.xml`

## Design knobs

The page sets defaults on `<html>` via data attributes that the CSS reads:

- `data-font` — `hand` (default), `grotesk`, `mono`, `serif`
- `data-case` — `upper` (default), `title`, `lower`
- `data-accent` — `cyan` (default), `blue`, `green`, `rust`, `ink`
- `data-motion` — `subtle` (default; halves the marks), `off` (hides them)

Change them in the markup to retune without touching CSS.
