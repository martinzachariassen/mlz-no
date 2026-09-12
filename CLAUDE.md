# CLAUDE.md

Personal homepage (mlz.no) — a static site with no build step. Everything in
`public/` is served as-is via Firebase Hosting.

## The project

- Bun (version pinned in `mise.toml`) is the package manager/runner — not
  npm/yarn.
- Biome for lint and format (`bun run lint`, `bun run format`).
- A pre-commit hook (`.githooks/pre-commit`) runs `bun run lint` — don't
  bypass it with `--no-verify`.
- No server, no client-side router: every page is its own `.html` file.
- All hardening (CSP, HSTS, cache-control) is declared in `firebase.json`,
  not in code. The `headers` list there is last-match-wins — be careful with
  ordering.
- Deploys happen automatically on push to `main`
  (`.github/workflows/deploy.yml`). Don't push/merge to `main` unless the
  user has asked for it.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):
`type: short description`, e.g. `fix: ...`, `feat: ...`, `chore: ...`,
`docs: ...`, `release: ...`. See `git log` for examples from this repo.

## Pull requests

Always use the template in `.github/pull_request_template.md` when opening a
PR — don't write a free-form description. Double-check the checklist items
actually match this repo (e.g. it's `bun run lint`, not `npm run ...`, and
there's no changesets/CONTRIBUTING.md flow here yet) before filling it in.

## CI

`ci.yml` boots the Hosting emulator and verifies that security headers,
cache policy, and the custom 404 page actually work in practice — not just
that `firebase.json` is syntactically valid. Test changes to `firebase.json`
or `public/404.html` against this CI job.
