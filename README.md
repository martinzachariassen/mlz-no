<div align="center">

# mlz.no

**Personal homepage for [Martin Zachariassen](https://mlz.no)** — senior software developer based in Oslo.

[![CI](https://img.shields.io/github/actions/workflow/status/martinzachariassen/mlz-no/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/martinzachariassen/mlz-no/codeql.yml?branch=main&label=CodeQL&style=flat-square)](https://github.com/martinzachariassen/mlz-no/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3-14151a?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-4-e36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Deployed on Railway](https://img.shields.io/badge/Railway-deploy-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)

[**mlz.no →**](https://mlz.no)

<img src="public/assets/social/og.png" alt="mlz.no — Martin Zachariassen, Senior Software Developer" width="640" />

</div>

## Overview

A single, static landing page with an editorial monospace layout on a paper
background. There's no build step for the site — the HTML and CSS in `public/`
are served as-is by a small, hardened [Bun](https://bun.sh) +
[Hono](https://hono.dev) server, deployed on [Railway](https://railway.app).

- **Type** — Space Mono + Architects Daughter, with Instrument Serif and Space
  Grotesk available as alternate name treatments (`data-font` on `<html>`).
- **Palette** — low-chroma accents (`data-accent` on `<html>`), cyan by default.
- **Motion** — drifting CSS-animated marks behind the hero; honours
  `prefers-reduced-motion`.
- **Analytics** — [Umami](https://umami.is), privacy-first and cookieless.

## Tech stack

| Layer      | Choice                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Runtime    | [Bun](https://bun.sh) (pinned via `mise.toml`)                          |
| Server     | [Hono](https://hono.dev) + hardening middleware, in TypeScript         |
| Frontend   | Hand-written HTML + CSS, no framework, no build                        |
| Hosting    | [Railway](https://railway.app) — auto-deploy from `main`               |
| Analytics  | [Umami](https://umami.is)                                              |

## Project layout

```text
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
railway.json            # Railway config-as-code (healthcheck path)
mise.toml               # pins Bun, defines the dev / start / typecheck tasks
```

A handful of files stay at the `public/` root on purpose: `robots.txt`,
`sitemap.xml`, and `favicon.ico` are requested by crawlers and browsers at
fixed, well-known paths, and `site.webmanifest` is conventionally root-served.
Everything else lives under `assets/`.

## Local development

Bun is pinned in `mise.toml` — run `mise install` if it isn't present yet. Then
start a hot-reloading preview:

```bash
mise run dev
```

Open <http://127.0.0.1:4173>.

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

Custom domains are set under **Settings → Networking** in the Railway dashboard;
SSL is handled automatically.

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

CI (`.github/workflows/ci.yml`) lints with [Biome](https://biomejs.dev),
type-checks the server, and boots it to smoke-test that the hardening still holds
— status codes for `GET`/`POST`/missing/traversal paths, plus the presence of the
key security headers. [CodeQL](https://codeql.github.com) scans on every push and
weekly, and [Dependabot](https://docs.github.com/code-security/dependabot) keeps
the Bun and GitHub Actions dependencies current.

> **Volumetric DDoS** — a true bandwidth / packet flood must be absorbed at the
> edge, not in the app. Front the Railway domain with **Cloudflare** (free tier,
> proxied DNS record) for network-layer DDoS protection, WAF rules, and caching.
> The hardening above keeps a single instance healthy against application-layer
> abuse; it is the last line of defence, not a substitute for an edge.

## Design knobs

The page sets defaults on `<html>` via data attributes that the CSS reads —
change them in the markup to retune without touching CSS:

| Attribute     | Default            | Options                            |
| ------------- | ------------------ | ---------------------------------- |
| `data-font`   | `hand`             | `grotesk`, `mono`, `serif`         |
| `data-case`   | `upper`            | `title`, `lower`                   |
| `data-accent` | `cyan`             | `blue`, `green`, `rust`, `ink`     |
| `data-motion` | `subtle`           | `off` (hides the drifting marks)   |

## License

[MIT](LICENSE) © Martin Zachariassen
