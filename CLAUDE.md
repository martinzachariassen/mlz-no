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
- URLs are extension-less (`cleanUrls: true` in `firebase.json`), so link to
  `/projects/<slug>`, never `/projects/<slug>.html`.

## Generated content

`public/projects/**`, `public/assets/figures/**` and `public/sitemap.xml` are
**generated** by `scripts/content/build-content.js` from `content/`, and the output is
committed. Never hand-edit those files — edit `content/site.json`,
`content/projects/<slug>.json` or `content/figures/<name>.svg`, then run
`bun run build:content`. `bun run lint` also runs `check:content`, which fails
if the committed output no longer matches `content/`.

`content/` has a spec: `content/README.md` is the prose version and
`scripts/content/content-schema.js` is the enforced one. The build validates every
file against it before rendering anything, and **a key that isn't in the spec
is an error** — that's the point of it. So adding a field to the site is two
edits in this order: describe it in `scripts/content/content-schema.js`, then render
it in `scripts/content/build-content.js`. Renderers downstream of validation assume
the shape the spec guarantees and don't re-check it. `scripts/content/content-schema.test.js`
(`bun run test`, also run by `bun run lint`) exercises that spec's own
cross-file checks against fixtures, so a regression there fails independently
of whatever happens to be in `content/` at the time.

After validation, `scripts/content/build-content.js` also checks that every
root-relative `href`/`src`/`og:image` the generated pages emit resolves to a
real file in `public/` — catching a typo in `ogImage`, a stylesheet name, or
similar before it ships as a silent broken link.

The site itself still has no build step: `public/` is deployed exactly as it
sits on disk. The generator only removes duplication between the bento tile,
the case study, the `<head>` tags and the sitemap.

Figures are one SVG per diagram with `{{token}}` colour placeholders; the
generator writes a `-light` and a `-dark` file from `palette` in
`content/site.json`, because an SVG loaded via `<img>` cannot see the page's
`[data-theme]`.

The topbar and footer are copied into each generated page by
`scripts/content/build-content.js`, and hand-written into `index.html` and
`404.html` — keep all three in sync when that markup changes.
- All hardening (CSP, HSTS, cache-control) is declared in `firebase.json`,
  not in code. The `headers` list there is last-match-wins — be careful with
  ordering.
- Deploys happen automatically once CI passes on `main`
  (`.github/workflows/deploy.yml` triggers on CI's `workflow_run`, never on
  the push itself). Don't push/merge to `main` unless the user has asked for
  it.

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

`scripts/smoke.sh <base-url>` holds every assertion about a running
deployment: security headers, cache policy, `cleanUrls`, the custom 404 page,
and a byte-for-byte comparison of every file in `public/` against what the
deployment serves. It runs twice, and it is one script so the two can't
drift:

- `ci.yml` boots the Hosting emulator and runs it against that, so
  `firebase.json` is verified in practice and not just parsed. Test changes to
  `firebase.json` or `public/404.html` here.
- `deploy.yml`'s `verify` job runs it against `https://mlz.no` after
  deploying, because `firebase deploy` succeeding only means the upload was
  accepted. Run it locally the same way: `scripts/smoke.sh https://mlz.no`.

Nothing reaches production without CI: `deploy.yml` is triggered by CI
concluding successfully, and its one manual entry point
(`workflow_dispatch`) refuses a commit that has no passing CI run.
