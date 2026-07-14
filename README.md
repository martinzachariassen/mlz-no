# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software
developer based in Oslo.

## Stack

- Static HTML + CSS in `public/` — no build step for the site itself.
- Served by a small, hardened [Bun](https://bun.sh) + [Hono](https://hono.dev)
  server (`src/index.ts`), written in TypeScript and deployed on
  [Railway](https://railway.app).
- Editorial monospace layout on a paper background — Space Mono + Architects
  Daughter (Instrument Serif and Space Grotesk available as alternate name
  treatments via `data-font` on `<html>`).
- Low-chroma accent palettes (`data-accent` on `<html>`) — cyan by default.
- Drifting CSS-animated marks behind the hero; honours `prefers-reduced-motion`.
- [Umami](https://umami.is) for privacy-first analytics.

## Project layout

```
public/                 # everything served to the browser
  index.html            #   the homepage
  robots.txt            #   crawler directives (well-known root path)
  sitemap.xml           #   single-URL sitemap (well-known root path)
  favicon.ico           #   legacy favicon (browsers auto-fetch /favicon.ico)
  site.webmanifest      #   PWA manifest
  assets/
    css/styles.css      #   all page styles
    icons/              #   favicon.svg, favicon-32/192.png, apple-touch-icon.png
    social/             #   og.png, twitter-card.png
src/index.ts            # Bun + Hono server: serves public/, hardened against abuse
package.json            # Bun project + scripts
tsconfig.json           # TypeScript config
mise.toml               # pins Bun, defines the dev / start tasks
```

A handful of files stay at the `public/` root on purpose: `robots.txt`,
`sitemap.xml`, and `favicon.ico` are requested by crawlers and browsers at
fixed, well-known paths, and `site.webmanifest` is conventionally root-served.
Everything else lives under `assets/`.

## Local development

Bun is pinned in `mise.toml` (`mise install` if it isn't present yet). Start a
hot-reloading preview with:

```bash
mise run dev
```

Then open <http://127.0.0.1:4173>.

Type-check the server (Bun runs the TypeScript directly, so this is only needed
in CI or before a commit):

```bash
mise run typecheck
```

## Deployment

The site deploys automatically to Railway on every push to `main`, straight from
the GitHub repo. Railway's Railpack builder detects Bun (via `package.json` +
`bun.lock`), runs `bun install`, and starts the server with `bun run start`. The
server binds to `::` on `$PORT` so the edge can reach the container over either
IPv4 or IPv6.

`railway.json` ([config as code](https://docs.railway.com/reference/config-as-code))
points Railway's healthcheck at `/health`. During a deploy Railway polls that
endpoint and only switches traffic to the new version once it returns `200`, so a
broken build never takes the live site down. The route is registered before the
rate limiter, so a flood can't throttle the probe into a false "unhealthy".

### Custom domain

Set under **Settings → Networking** in the Railway dashboard. SSL is handled
automatically.

## Resilience & hardening

`src/index.ts` leans on well-maintained, mostly first-party middleware rather
than hand-rolled code:

- **Security headers on every response** (`hono/secure-headers`) — a CSP scoped
  to exactly what the page loads (Google Fonts + Umami), plus HSTS, `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy`.
- **Per-client rate limiting** (`hono-rate-limiter`) — fixed window keyed on the
  left-most `X-Forwarded-For` entry; the in-memory store resets each window and
  is fine for a single instance.
- **Safe static serving** (`hono/bun` `serveStatic`) — resolves requests within
  `public/`, so path traversal is blocked by construction.
- **Method allowlist** — only `GET`/`HEAD`; everything else is `405`.
- **Timeouts & body cap** — `idleTimeout` blunts slow / idle connections
  (slowloris); `maxRequestBodySize` rejects oversized bodies. Malformed input
  returns a `4xx` / `500` rather than crashing the process.

Tunable via env vars (sensible defaults): `RATE_LIMIT_MAX` (per window),
`RATE_LIMIT_WINDOW_MS`, `PORT`, `HOST`.

> **Volumetric DDoS** — a true bandwidth / packet flood must be absorbed at the
> edge, not in the app. Front the Railway domain with **Cloudflare** (free tier,
> proxied DNS record) for network-layer DDoS protection, WAF rules, and caching.
> The hardening above keeps a single instance healthy against application-layer
> abuse; it is the last line of defence, not a substitute for an edge.

## Files served from `public/`

Root (fixed well-known paths):

- `index.html` — the homepage
- `favicon.ico` — legacy favicon; browsers auto-fetch `/favicon.ico`
- `site.webmanifest` — PWA manifest (name, theme colour, icons)
- `robots.txt`, `sitemap.xml`

`assets/css/`:

- `styles.css` — all page styles

`assets/icons/`:

- `favicon.svg`, `favicon-32.png`, `favicon-192.png` — favicon set, also
  referenced as PWA icons from `site.webmanifest`
- `apple-touch-icon.png` — 180×180 iOS home-screen icon

`assets/social/`:

- `og.png` — 1200×630 Open Graph card
- `twitter-card.png` — 1200×675 Twitter / X card

## Design knobs

The page sets defaults on `<html>` via data attributes that the CSS reads:

- `data-font` — `hand` (default), `grotesk`, `mono`, `serif`
- `data-case` — `upper` (default), `title`, `lower`
- `data-accent` — `cyan` (default), `blue`, `green`, `rust`, `ink`
- `data-motion` — `subtle` (default; halves the marks), `off` (hides them)

Change them in the markup to retune without touching CSS.
