<div align="center">

<img src="assets/banner.png" alt="mlz.no — Martin Zachariassen, personal homepage" width="100%">

<br><br>

[![CI](https://img.shields.io/github/actions/workflow/status/martinzachariassen/mlz-no/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/martinzachariassen/mlz-no/codeql.yml?branch=main&label=CodeQL&style=flat-square)](https://github.com/martinzachariassen/mlz-no/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/martinzachariassen/mlz-no/badge)](https://scorecard.dev/viewer/?uri=github.com/martinzachariassen/mlz-no)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Bun](https://img.shields.io/badge/Bun-1.3-14151a?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-4-e36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Deployed on Railway](https://img.shields.io/badge/Railway-deploy-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)

[**Live site**](https://mlz.no) · [Quick start](#quick-start) · [Design system](#design-system) · [Tech stack](#tech-stack) · [Hardening](#security--hardening) · [Deployment](#deployment) · [Configuration](#configuration)

<a href="https://mlz.no">
  <img src="public/assets/social/og.png" alt="mlz.no — Martin Zachariassen, Senior Software Developer" width="640" />
</a>

</div>

## About

**The personal homepage of [Martin Zachariassen](https://mlz.no)** — a single-page,
editorial monospace landing page on a paper background. The frontend is a small
[Vite](https://vite.dev) + [React](https://react.dev) + TypeScript app — composed
from a handful of focused components, styled entirely from
[`@martinzachariassen/design`](https://github.com/martinzachariassen/mlz-design),
and driven by a single `profile` data source — built to static assets and served
by a ~100-line TypeScript server that exists for one reason: to stay up and stay
safe without a heavy framework in front of it.

- **Design-system UI** — every visual — palette, type, motion, the brand mark
  itself — is inherited from [`@martinzachariassen/design`](#design-system)
  rather than hand-rolled per project, so this site and every other MLZ project
  share one look and move together when the system changes.
- **Lightweight component composition** — React + TypeScript, one component per
  section, all page content driven from `src/data/profile.ts`.
- **Hardened by default** — strict CSP, rate limiting, method allowlist, and
  traversal-safe static serving on every response. The build ships no inline
  `<script>`/`<style>` tags, so `script-src` / `style-src` stay free of
  `unsafe-inline` — the design system's own inline `style` props apply via the
  CSSOM on the client, which `style-src` doesn't govern.
- **Respectful motion & analytics** — the design system's drifting marks and
  glitch accents honour `prefers-reduced-motion`; cookieless, privacy-first
  [Umami](https://umami.is) analytics.
- **Boring, verifiable CI** — every push lints, type-checks, builds, then boots
  the real server and asserts the hardening still holds.

## Quick start

> [Bun](https://bun.sh) is pinned in `mise.toml` — [mise](https://mise.jdx.dev)
> installs the right version for you.

```bash
git clone https://github.com/martinzachariassen/mlz-no.git
cd mlz-no
mise install     # installs the pinned Bun
bun install      # installs React, Vite, Hono + middleware
mise run dev     # Vite dev server with HMR on http://127.0.0.1:4173
```

All day-to-day tasks live in `mise.toml`:

| Task                 | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `mise run dev`       | Vite dev server with HMR on port `4173`               |
| `mise run build`     | Build the production bundle into `dist/`              |
| `mise run preview`   | Preview the production build with Vite               |
| `mise run start`     | Serve `dist/` via the Bun + Hono server              |
| `mise run typecheck` | Type-check the app and server (`tsc --noEmit`)        |
| `mise run lint`      | Lint + format check with Biome (read-only)            |
| `mise run format`    | Format and auto-fix with Biome                        |

## Tech stack

| Layer     | Choice                                                          |
| --------- | --------------------------------------------------------------- |
| Runtime   | [Bun](https://bun.sh) — pinned via `mise.toml`                  |
| Frontend  | [React](https://react.dev) 19 + TypeScript                     |
| Build     | [Vite](https://vite.dev) 7                                      |
| Server    | [Hono](https://hono.dev) + first-party middleware, TypeScript   |
| Tooling   | [Biome](https://biomejs.dev) for lint + format                  |
| Hosting   | [Railway](https://railway.app) — auto-deploy from `main`        |
| Analytics | [Umami](https://umami.is) — cookieless, privacy-first           |

## Design system

The look — palette, type, motion, the brand mark itself — comes from
[`@martinzachariassen/design`](https://github.com/martinzachariassen/mlz-design),
installed as a private [GitHub Packages](https://github.com/features/packages)
dependency rather than redefined in this repo. Change a token there, cut a
release, and this site (and every other MLZ project) picks it up.

**1. Point the scope at GitHub Packages** — already committed as [`.npmrc`](.npmrc):

```ini
@martinzachariassen:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**2. Authenticate.** Every install — local or CI — needs a `GITHUB_TOKEN` with
`read:packages`, since GitHub Packages requires auth even for reading a package
you own:

- **Local:** `export GITHUB_TOKEN=$(gh auth token)` before `bun install` (uses
  the token the [GitHub CLI](https://cli.github.com) already holds from
  `gh auth login`).
- **CI** ([`ci.yml`](.github/workflows/ci.yml),
  [`lighthouse.yml`](.github/workflows/lighthouse.yml)): the workflow's
  automatic, per-run `GITHUB_TOKEN` is used directly — no secret to manage. This
  only works because the `mlz-design` package's **Manage Actions access**
  settings explicitly grant this repo Read.
- **Railway:** has no ambient token, so a `GITHUB_TOKEN` (PAT, `read:packages`)
  is set as a dashboard environment variable.

**3. Inherit it** — `src/styles/index.css` imports the package's tokens and base
layer, and `@source`s its compiled classes so Tailwind emits them:

```css
@import "tailwindcss";
@import "@martinzachariassen/design/styles/theme.css";
@import "@martinzachariassen/design/styles/base.css";
@source "../../node_modules/@martinzachariassen/design/dist";
```

(Google Fonts stays on a preconnected `<link>` in `index.html` rather than the
package's bundled `@import`, so Tailwind's layer hoisting doesn't drop it — see
[`index.html`](index.html).)

Components then import straight from the package —
`import { BrandMark, GlitchText, buttonVariants } from "@martinzachariassen/design"`
— styled with its semantic Tailwind tokens (`bg-background`, `text-foreground`,
`animate-rise`…). Retune the whole site from [`index.html`](index.html)'s
`<html>` attributes: `data-accent` (`cyan` · `blue` · `green` · `rust` · `ink`)
and a `dark` class for the ink theme.

## Project structure

```text
index.html              # Vite entry — head metadata, JSON-LD, data-accent on <html>
src/
├── main.tsx            #   React entry — mounts <App> into #root
├── App.tsx             #   composition root
├── components/         #   one component per section of the page
│   ├── Hero.tsx        #     the page shell (design system's FloatingMarks + sections)
│   ├── TopBar.tsx      #     brand lockup + "building since" strip
│   ├── Identity.tsx    #     name, role, and the contact links
│   ├── ContactLinks.tsx#     the GitHub / LinkedIn / Email buttons
│   ├── Footer.tsx      #     copyright + coordinates
│   └── icons/          #     inline SVG icon components
├── data/
│   └── profile.ts      #     all page copy + contact links (single source of truth)
└── styles/
    └── index.css       #     Tailwind + design-system imports, one `@layer base` tweak
public/                 # copied verbatim to the dist root by Vite
├── robots.txt          #   crawler directives (well-known root path)
├── sitemap.xml         #   single-URL sitemap (well-known root path)
├── favicon.ico         #   legacy favicon (browsers auto-fetch /favicon.ico)
├── site.webmanifest    #   PWA manifest
└── assets/
    ├── icons/          #   favicon.svg, favicon-32/192.png, apple-touch-icon.png — the MLZ mark
    └── social/         #   og.png, twitter-card.png — built on the design system's SocialCard frame
assets/
└── banner.png          # README header banner (design system's RepoBanner, standard layout)
server/index.ts         # Bun + Hono server: serves dist/, hardened against abuse
vite.config.ts          # Vite config (React + Tailwind v4 plugins, CSP-safe build settings)
railway.json            # Railway config-as-code (healthcheck path)
mise.toml               # pins Bun, defines the dev / build / start / lint tasks
```

`robots.txt`, `sitemap.xml`, and `favicon.ico` stay at the `public/` root on
purpose — crawlers and browsers request them at fixed, well-known paths — and
`site.webmanifest` is conventionally root-served. Vite copies `public/` to the
`dist/` root untouched, so those URLs are preserved.

## Security & hardening

The server ([`server/index.ts`](server/index.ts)) leans on well-maintained,
mostly first-party middleware rather than hand-rolled code. Each threat maps to
one deliberate defence:

| Threat                        | Defence                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| XSS / content injection       | CSP scoped to exactly what the page loads (bundled JS/CSS from self, Google Fonts, Umami), via `hono/secure-headers`; the Vite build ships no inline scripts or styles |
| Clickjacking, sniffing, leaks | `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy` on every response             |
| Request floods (L7)           | Per-client rate limiting (`hono-rate-limiter`), fixed window keyed on the left-most `X-Forwarded-For` entry     |
| Path traversal                | `serveStatic` resolves strictly within `dist/` — blocked by construction                                        |
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

**Verified in CI.** [`ci.yml`](.github/workflows/ci.yml) runs two stages: a
**build** job lints with Biome, type-checks, builds the bundle, and uploads
`dist/` as an artifact; a **smoke** job then downloads that exact artifact, boots
the real server, and asserts the contract — status codes for
`GET`/`POST`/missing/traversal paths and the presence of the key security
headers. Testing the uploaded artifact means CI exercises the same bundle that
would deploy, not a rebuilt copy. [CodeQL](https://codeql.github.com) scans on every push and weekly;
[Dependabot](https://docs.github.com/code-security/dependabot) keeps Bun and
GitHub Actions dependencies current; and
[OpenSSF Scorecard](https://scorecard.dev) grades the repo's supply-chain
posture and publishes the score behind the badge above.

## Deployment

Every push to `main` deploys automatically to [Railway](https://railway.app).
Railway's Railpack builder detects Bun (via `package.json` + `bun.lock`), runs
`bun install`, builds the app with `bun run build`, and starts the server with
`bun run start` — which serves the generated `dist/`. The server binds to `::`
on `$PORT` so the edge can reach the container over IPv4 or IPv6.

[`railway.json`](railway.json)
([config as code](https://docs.railway.com/reference/config-as-code)) pins the
build (`bun run build`) and start (`bun run start`) commands and points the
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

Retuning the visual theme is a [design system](#design-system) concern — see
that section for the `data-accent` / dark-mode knobs on `<html>`.

## License

[MIT](LICENSE) © [Martin Zachariassen](https://mlz.no)

---

<div align="center">
<sub>Built with <a href="https://bun.sh">Bun</a> and <a href="https://hono.dev">Hono</a> · Deployed on <a href="https://railway.app">Railway</a> · <a href="https://mlz.no">mlz.no</a></sub>
</div>
