# Changelog

All notable changes to mlz.no are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/).

The brand baseline in `public/brand/` is versioned separately, with
`brand-vX.Y.Z` tags (see [`BRAND.md`](public/brand/BRAND.md)). It is
unchanged in this release and stays at `brand-v1.0.0`.

## [1.1.0] - 2026-10-23

### Added

- Brand baseline at [mlz.no/brand](https://mlz.no/brand/BRAND.md), generated
  from `tokens.json`: CSS tokens, a Tailwind v4 preset, `brand.json`, logo
  SVGs/PNGs and bundled fonts. It is served cross-origin and checked in CI
  (#50).
- `llms.txt` and documentation of the brand workflow (#50).
- Terraform in `infra/` for the GCP project, Hosting site, custom domain,
  Workload Identity Federation, deploy service account and GitHub repo
  settings (#51).
- Shared `scripts/verify.sh`, PR preview deploys, a Terraform check and a
  weekly GCP auth check in CI (#51).
- Pull request template and `CLAUDE.md` project guidelines (#41).
- The site follows the system theme and updates live when the OS theme
  changes, until a theme is chosen manually. The new theme is revealed as a
  circle from the toggle where View Transitions are supported (#48).

### Changed

- Display font is now Newsreader, and the woff2 is preloaded to avoid a
  fallback-font flash on the hero name (#41, #48).
- Theme toggle is rebuilt as a bare icon with a soft hover background; its
  `aria-label` names the action (e.g. "Switch to dark theme") (#44).
- Dark theme secondary and muted text are lowered to match the hierarchy of
  the light theme, still above WCAG AA (#48).
- The SVG favicon now matches the brand mark (an M knocked out of a rounded
  square) (#48).
- The Open Graph image is regenerated from `tools/og/og.html` with the
  site's own fonts and tokens, and can be re-rendered when the design
  changes (#49).
- The local Hosting emulator runs on port 5050, since macOS AirPlay Receiver
  occupies 5000 (#48).
- Biome now lints and formats `public/**/*.js`, not just `public/*.js` (#48).
- CI jobs install only the tools they use (#51).

### Fixed

- Hover styles apply only on hover-capable devices, so buttons no longer stay
  lifted after a tap on touch screens. Buttons also get a pressed state
  (#48).
- Glitch text is read as an intact string by screen readers instead of being
  spelled out letter by letter (#48).
- `/brand/` and `/brand/logo/` redirect to `BRAND.md` instead of returning
  404 (#50).
- The deploy service account description is kept in Terraform (#51).

### Removed

- The terminal easter egg on the 404 page, with its CSS and JS (#41).
- The "Building since 2017" badge from the topbar (#44).

### Dependencies

- Routine updates of `@biomejs/biome`, `firebase-tools` and
  `jdx/mise-action` (#40, #43, #45, #46, #47).

## [1.0.0] - 2026-09-03

Initial public release: a static site (plain HTML/CSS/JS, no build step)
served via Firebase Hosting, with dark/light theming, a terminal easter egg
on the 404 page, and security headers and cache policy declared in
`firebase.json`.

[1.1.0]: https://github.com/martinzachariassen/mlz-no/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/martinzachariassen/mlz-no/releases/tag/v1.0.0
