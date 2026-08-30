# mlz-no

Personal homepage for Martin Zachariassen — a Vite + React app served as static assets from Firebase Hosting.

[![CI](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/mlz-no/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/martinzachariassen/mlz-no/badge)](https://scorecard.dev/viewer/?uri=github.com/martinzachariassen/mlz-no)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

![The mlz.no homepage — Martin Zachariassen, Senior Software Developer, Oslo](docs/assets/hero.png)

**Status:** Live in production at [mlz.no](https://mlz.no).

## What it does

- A single-page editorial homepage: name, role, and contact links, with all page copy driven from one file (`src/data/profile.ts`).
- Ships as **static files on Firebase Hosting** — no Cloud Function, no rewrite to a backend, so nothing executes per request. Every response carries a strict CSP and the full security-header set, declared once in [`firebase.json`](firebase.json) rather than applied by middleware. The Vite build emits no inline `<script>`/`<style>`, so `script-src`/`style-src` stay free of `unsafe-inline`.
- Every visual — palette, type, motion, the brand mark — is inherited from the private [`@martinzachariassen/design`](https://github.com/martinzachariassen/mlz-design) system, so this site and every other MLZ project share one look and update together.
- It does **not** run a server, use runtime environment variables, or rate-limit in process (floods are absorbed by Hosting's CDN), and it has no client-side router — an unknown path returns a real `404` with a custom HTML error page ([`404.html`](404.html)), never a soft `200`.

## Quickstart

Requires [mise](https://mise.jdx.dev) and an authenticated [GitHub CLI](https://cli.github.com) — the design system is a private GitHub Packages dependency, so `bun install` needs a token with `read:packages`.

```bash
git clone https://github.com/martinzachariassen/mlz-no.git
cd mlz-no
mise install                          # installs the pinned Bun
export GITHUB_TOKEN=$(gh auth token)  # auth for the private design system
bun install                           # React, Vite, and the design system
mise run dev                          # serves http://127.0.0.1:4173 with HMR
```

## Configuration

There are no runtime environment variables — nothing executes per request. What remains is build-time and deploy-time.

| Variable                | Used by              | Required | Description                                                                                                           |
| ----------------------- | -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`          | install (local + CI) | yes      | `read:packages` scope; pulls `@martinzachariassen/design` from GitHub Packages. Locally, `gh auth token` supplies it. |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | deploy (repo variable) | yes | Full resource path of the Workload Identity provider. Not a secret. |
| `GCP_SERVICE_ACCOUNT`   | deploy (repo variable) | yes | `gh-deploy@mlz-no.iam.gserviceaccount.com`, the account the deploy impersonates. Not a secret. |

The deploy holds no credential at all: GitHub mints an OIDC token per run, Workload Identity Federation exchanges it for short-lived Google credentials, and the provider's attribute condition restricts the exchange to this repository. Deploy-time behaviour lives in [`firebase.json`](firebase.json) — public directory, security headers, and cache policy per path — with the target project in [`.firebaserc`](.firebaserc).

The visual theme is the reader's: a `ThemeToggle` (light · dark · system) and an `AccentPicker` (`cyan` · `blue` · `green` · `rust` · `ink`) persist their choice to `localStorage` under `mlz-theme` and `mlz-accent`, and the design system applies it as a `dark` class and a `data-accent` attribute on `<html>`. The markup in [`index.html`](index.html) only carries the no-JS default. Because `script-src` is `'self'`, the pre-paint bootstrap that prevents a flash of the wrong theme cannot be inlined — [`vite/theme-init.ts`](vite/theme-init.ts) emits it as a hashed same-origin script instead.

Fonts are self-hosted: all four families — Space Grotesk, Space Mono, Architects Daughter and Instrument Serif — ship inside the design system and are fingerprinted into `/bundle/`. Nothing is fetched from a third-party origin, which is why `font-src` and `style-src` are both `'self'`.

## Architecture

Vite builds the React + TypeScript app and the design system's tokens into `dist/`, which `firebase deploy` uploads to Firebase Hosting as static files. The one thing to get right: there is no server. Nothing runs per request — hardening and caching are configuration ([`firebase.json`](firebase.json)), not code. Content-hashed bundles under `/bundle/` are served `immutable`; stable-URL favicons and social cards under `/assets/` are not. Those favicons and social cards are committed output — the design system's generator that produced them was removed in v0.4.0, so they are now maintained by hand.

```mermaid
flowchart LR
  Vite[vite build] --> Dist[(dist/ static assets)]
  Dist -->|firebase deploy| Edge[Firebase Hosting CDN]
  Browser -->|GET| Edge
  Edge -.->|firebase.json: CSP + cache policy| Browser
```

## Development

```bash
mise install                          # pinned Bun
export GITHUB_TOKEN=$(gh auth token)
bun install
mise run lint                         # Biome lint + format check
mise run typecheck                    # tsc --noEmit (app + build config)
mise run build                        # production bundle -> dist/
```

| Task                      | What it does                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| `mise run dev`            | Vite dev server with HMR on port `4173`                              |
| `mise run build`          | Build the production bundle into `dist/`                             |
| `mise run preview`        | Preview the production build with Vite                               |
| `mise run preview:hosting` | Serve `dist/` through the local Hosting emulator (applies `firebase.json`) |
| `mise run deploy`         | Deploy `dist/` to Firebase Hosting                                   |
| `mise run typecheck`      | Type-check the app and build config (`tsc --noEmit`)                 |
| `mise run lint`           | Lint + format check with Biome (read-only)                           |
| `mise run format`         | Format and auto-fix with Biome                                       |

On every push, [`ci.yml`](.github/workflows/ci.yml) lints, type-checks, and builds, then boots the built `dist/` under the Firebase Hosting emulator and asserts that status codes, every security header, and the cache policy still hold. [CodeQL](https://codeql.github.com), [Dependabot](https://docs.github.com/code-security/dependabot), and [OpenSSF Scorecard](https://scorecard.dev) run on separate schedules.

## Deployment

Every push to `main` runs [`deploy.yml`](.github/workflows/deploy.yml): install, `mise run build`, authenticate to Google Cloud over OIDC, `firebase deploy --only hosting`. The deploy runs from GitHub Actions rather than a Git-integrated build on Firebase's side because the build needs a GitHub Packages token for the design system, and Actions supplies one (`GITHUB_TOKEN`) per run.

Every release is also reachable at `mlz-no.web.app` and `mlz-no.firebaseapp.com`. Firebase Hosting always serves those and they cannot be turned off, so [`index.html`](index.html) carries an absolute `rel="canonical"` and `og:url` pointing at `https://mlz.no/` to keep them out of search results. Hosting also reserves the `/__/*` path namespace for its own SDK helpers.

`mlz.no` is a custom domain on the `mlz-no` site; DNS stays in Cloudflare as plain DNS (no proxy), with `www.mlz.no` registered as a second custom domain that redirects to the apex. Rollback: redeploy the previous commit on `main`, or roll back the release in the Firebase console.

## Contributing

This is my personal homepage, so I probably won't take feature PRs — but issues and fixes are welcome. Run `mise run lint && mise run typecheck` before opening one.

## License

[MIT](LICENSE) © [Martin Zachariassen](https://mlz.no)
