# Deploying to Cloudflare Workers

This site ships as a **static-assets-only Cloudflare Worker**: `dist/` is served
straight from Cloudflare's edge, with no `main` entrypoint and no per-request
JavaScript. Security headers and cache policy live in
[`public/_headers`](public/_headers); the Worker itself is declared in
[`wrangler.jsonc`](wrangler.jsonc).

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which installs, builds `dist/`, and publishes it with `wrangler deploy`.

Follow the steps below once to go live; after that, deploys are automatic.

---

## 1. Regenerate the lockfile (one-time)

The migration changed `package.json` (removed `hono` / `hono-rate-limiter` /
`@types/bun`, added `wrangler`), so `bun.lock` must be regenerated. Every CI and
deploy job runs `bun install --frozen-lockfile`, which fails until the lockfile
matches.

```bash
bun install
git add bun.lock
git commit -m "chore: regenerate lockfile for Cloudflare migration"
git push
```

Verify: `grep -c hono bun.lock` prints `0`, and `grep -c wrangler bun.lock` is
non-zero.

## 2. Get your Cloudflare Account ID

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Open **Workers & Pages** — the **Account ID** is in the right-hand sidebar.
   This is `CLOUDFLARE_ACCOUNT_ID`.

## 3. Create an API token

**My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template.**

- Account Resources: your account.
- Zone Resources: leave as-is (or scope to `mlz.no` once the zone exists).
- Create, then copy the token **once** — it is not shown again. This is
  `CLOUDFLARE_API_TOKEN`.

## 4. Add the two GitHub repository secrets

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID  --repo martinzachariassen/mlz-no
gh secret set CLOUDFLARE_API_TOKEN   --repo martinzachariassen/mlz-no
```

Each command prompts for the value, so nothing lands in your shell history.
`deploy.yml` reads exactly these two secret names.

## 5. First deploy

Merging to `main` triggers `deploy.yml`, which builds and runs `wrangler deploy`.
The first run **auto-creates** the Worker named `mlz-no` (from `wrangler.jsonc`)
and publishes it to:

```
https://mlz-no.<your-subdomain>.workers.dev
```

Confirm that URL serves the site before touching DNS.

> **Dry run first (optional):** after step 1, `bunx wrangler deploy --dry-run`
> validates the config and build without publishing anything.

## 6. Bind the `mlz.no` custom domain

Custom domains require `mlz.no` to be an **active zone on the same Cloudflare
account**.

- **If the zone isn't on Cloudflare yet:** add the site in Cloudflare and update
  the nameservers at your registrar. This is the real cutover from the previous
  host — do it when you're ready to move production.
- **Once the zone is active:** **Workers & Pages → mlz-no → Settings → Domains &
  Routes → Add → Custom Domain → `mlz.no`.** Cloudflare provisions the DNS record
  and SSL automatically.

The `routes` block in `wrangler.jsonc` stays commented out with this approach. To
keep the binding in version control instead, uncomment it once the zone exists:

```jsonc
"routes": [{ "pattern": "mlz.no", "custom_domain": true }]
```

## 7. Decommission the old host

Once `mlz.no` serves from Cloudflare and looks correct, tear down the previous
Railway service/project and remove any DNS records that still point at it. The
repository is already free of the old stack — `railway.json` and `server/` were
deleted in the migration.

---

## Local preview against the real runtime

```bash
mise run build          # produce dist/
mise run preview:worker # serve dist/ through local workerd (wrangler dev)
```

This applies `public/_headers` and mirrors production behaviour more closely than
`mise run preview` (plain Vite). CI runs the same `wrangler dev` runtime to smoke
-test status codes, security headers, and cache policy on every push.

## Configuration reference

| File                                 | Controls                                           |
| ------------------------------------ | -------------------------------------------------- |
| [`wrangler.jsonc`](wrangler.jsonc)   | Worker name, asset directory, 404 handling, routes |
| [`public/_headers`](public/_headers) | Security headers and cache policy per path          |

There are no runtime environment variables — there is no runtime.
