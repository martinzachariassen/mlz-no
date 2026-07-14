<div align="center">

# mlz.no

**The personal homepage of [Martin Zachariassen](https://mlz.no)** — hand-written HTML & CSS,
served by a small, hardened [Bun](https://bun.sh) + [Hono](https://hono.dev) server.

[![CI](https://img.shields.io/github/actions/workflow/status/martinzachariassen/mlz-no/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/martinzachariassen/mlz-no/codeql.yml?branch=main&label=CodeQL&style=flat-square)](https://github.com/martinzachariassen/mlz-no/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/martinzachariassen/mlz-no/badge)](https://scorecard.dev/viewer/?uri=github.com/martinzachariassen/mlz-no)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3-14151a?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-4-e36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Deployed on Railway](https://img.shields.io/badge/Railway-deploy-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)

[**Live site**](https://mlz.no) · [Quick start](#quick-start) · [Tech stack](#tech-stack) · [Hardening](#security--hardening) · [Deployment](#deployment) · [Configuration](#configuration)

<a href="https://mlz.no">
  <img src="public/assets/social/og.png" alt="mlz.no — Martin Zachariassen, Senior Software Developer" width="640" />
</a>

</div>

## About

A single static landing page with an editorial monospace layout on a paper
background. There is **no build step** — the HTML and CSS in `public/` are
served exactly as written, by a ~100-line TypeScript server that exists for one
reason: to stay up and stay safe without a framework in front of it.

- **Zero-build frontend** — hand-written HTML + CSS, no bundler, no framework,
  nothing to compile.
- **Hardened by default** — strict CSP, rate limiting, method allowlist, and
  traversal-safe static serving on every response.
- **Editorial typography** — Space Mono + Architects Daughter, with alternate
  name treatments one attribute away ([design knobs](#design-knobs)).
- **Respectful motion & analytics** — CSS-animated marks that honour
  `prefers-reduced-motion`; cookieless, privacy-first [Umami](https://umami.is)
  analytics.
- **Boring, verifiable CI** — every push lints, type-checks, then boots the real
  server and asserts the hardening still holds.

## Quick start

> [Bun](https://bun.sh) is pinned in `mise.toml` — [mise](https://mise.jdx.dev)
> installs the right version for you.

```bash
git clone https://github.com/martinzachariassen/mlz-no.git
cd mlz-no
mise install     # installs the pinned Bun
bun install      # installs Hono + middleware
mise run dev     # hot-reloading server on http://127.0.0.1:4173
```

All day-to-day tasks live in `mise.toml`:

| Task                 | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `mise run dev`       | Serve `public/` with hot reload on port `4173`    |
| `mise run start`     | Serve in production mode                          |
| `mise run typecheck` | Type-check the server (`tsc --noEmit`)            |
| `mise run lint`      | Lint + format check with Biome (read-only)        |
| `mise run format`    | Format and auto-fix with Biome                    |

## Tech stack

| Layer     | Choice                                                          |
| --------- | --------------------------------------------------------------- |
| Runtime   | [Bun](https://bun.sh) — pinned via `mise.toml`                  |
| Server    | [Hono](https://hono.dev) + first-party middleware, TypeScript   |
| Frontend  | Hand-written HTML + CSS — no framework, no build                |
| Tooling   | [Biome](https://biomejs.dev) for lint + format                  |
| Hosting   | [Railway](https://railway.app) — auto-deploy from `main`        |
| Analytics | [Umami](https://umami.is) — cookieless, privacy-first           |

## Project structure

```text
public/                 # everything served to the browser
├── index.html          #   the homepage
├── robots.txt          #   crawler directives (well-known root path)
├── sitemap.xml         #   single-URL sitemap (well-known root path)
├── favicon.ico         #   legacy favicon (browsers auto-fetch /favicon.ico)
├── site.webmanifest    #   PWA manifest
└── assets/
    ├── css/styles.css  #   all page styles
    ├── icons/          #   favicon.svg, favicon-32/192.png, apple-touch-icon.png
    └── social/         #   og.png, twitter-card.png
src/index.ts            # Bun + Hono server: serves public/, hardened against abuse
railway.json            # Railway config-as-code (healthcheck path)
mise.toml               # pins Bun, defines the dev / start / lint / typecheck tasks
```

`robots.txt`, `sitemap.xml`, and `favicon.ico` stay at the `public/` root on
purpose — crawlers and browsers request them at fixed, well-known paths — and
`site.webmanifest` is conventionally root-served. Everything else lives under
`assets/`.

## Security & hardening

The server ([`src/index.ts`](src/index.ts)) leans on well-maintained, mostly
first-party middleware rather than hand-rolled code. Each threat maps to one
deliberate defence:

| Threat                        | Defence                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| XSS / content injection       | CSP scoped to exactly what the page loads (Google Fonts + Umami), via `hono/secure-headers`                     |
| Clickjacking, sniffing, leaks | `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy` on every response             |
| Request floods (L7)           | Per-client rate limiting (`hono-rate-limiter`), fixed window keyed on the left-most `X-Forwarded-For` entry     |
| Path traversal                | `serveStatic` resolves strictly within `public/` — blocked by construction                                      |
| Method abuse                  | `GET`/`HEAD` allowlist; everything else gets a `405`                                                            |
| Slowloris / oversized bodies  | 30 s `idleTimeout` and a 16 KiB request-body cap                                                                |
| Crashes on malformed input    | Central `onError` turns any thrown handler into a generic `500` — nothing leaks, the process stays up           |
| Broken deploys                | Railway only shifts traffic once `/health` returns `200`; the route sits *before* the rate limiter so a flood can't fake an unhealthy probe |

> [!IMPORTANT]
> A true volumetric DDoS must be absorbed at the **edge**, not in the app.
> Front the Railway domain with Cloudflare (free tier, proxied DNS record) for
> network-layer protection, WAF rules, and caching. The hardening above keeps a
> single instance healthy against application-layer abuse — it's the last line
> of defence, not a substitute for an edge.

**Verified in CI.** [`ci.yml`](.github/workflows/ci.yml) lints with Biome,
type-checks, then boots the real server and asserts the contract: status codes
for `GET`/`POST`/missing/traversal paths and the presence of the key security
headers. [CodeQL](https://codeql.github.com) scans on every push and weekly;
[Dependabot](https://docs.github.com/code-security/dependabot) keeps Bun and
GitHub Actions dependencies current; and
[OpenSSF Scorecard](https://scorecard.dev) grades the repo's supply-chain
posture and publishes the score behind the badge above.

## Deployment

Every push to `main` deploys automatically to [Railway](https://railway.app).
Railway's Railpack builder detects Bun (via `package.json` + `bun.lock`), runs
`bun install`, and starts the server with `bun run start`. The server binds to
`::` on `$PORT` so the edge can reach the container over IPv4 or IPv6.

[`railway.json`](railway.json)
([config as code](https://docs.railway.com/reference/config-as-code)) points the
healthcheck at `/health` — during a deploy, traffic only switches to the new
version once it returns `200`, so a broken build never takes the live site down.

Custom domains are configured under **Settings → Networking** in the Railway
dashboard; SSL is automatic.

## Configuration

### Environment variables

Sensible defaults, all optional:

| Variable               | Default | Purpose                             |
| ---------------------- | ------- | ----------------------------------- |
| `PORT`                 | `4173`  | Port the server listens on          |
| `HOST`                 | `::`    | Bind address (dual-stack)           |
| `RATE_LIMIT_MAX`       | `120`   | Requests allowed per window         |
| `RATE_LIMIT_WINDOW_MS` | `10000` | Rate-limit window length in ms      |

### Design knobs

The page sets defaults on `<html>` via data attributes that the CSS reads —
retune the look from the markup without touching a line of CSS:

| Attribute     | Default  | Options                          |
| ------------- | -------- | -------------------------------- |
| `data-font`   | `hand`   | `grotesk`, `mono`, `serif`       |
| `data-case`   | `upper`  | `title`, `lower`                 |
| `data-accent` | `cyan`   | `blue`, `green`, `rust`, `ink`   |
| `data-motion` | `subtle` | `off` (hides the drifting marks) |

## License

[MIT](LICENSE) © [Martin Zachariassen](https://mlz.no)

---

<div align="center">
<sub>Built with <a href="https://bun.sh">Bun</a> and <a href="https://hono.dev">Hono</a> · Deployed on <a href="https://railway.app">Railway</a> · <a href="https://mlz.no">mlz.no</a></sub>
</div>
