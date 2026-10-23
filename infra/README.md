# infra/

Everything about how mlz.no is *set up* in Google Cloud and GitHub, written
down as Terraform:
- the project, its APIs, Firebase Hosting and the custom domain
- the keyless deploy login (Workload Identity Federation), plus the deploy
  service account and its roles
- the repository's settings, variables, environments and branch rules

If it's in this folder, change it here and not in a console. A click in the
console shows up as drift in the next `terraform plan`.

The same layout is used in ip.mlz.no (`ip-mlz-no/infra/`).

## What is *not* here, and why

The rule: Terraform owns what describes the setup and changes rarely.
`firebase deploy` owns what ships on every merge.

| Not in Terraform | Where it lives instead |
|---|---|
| Hosting content, headers, cache rules, redirects | `public/` and `firebase.json`, deployed by `deploy.yml` |
| Google-managed service agents, `firebase-adminsdk-*`, the APIs GCP enables by default | Owned by Google; managing them adds noise and no control |
| Billing account link | Set in the console, so the account ID stays out of the public repo |
| DNS records for `mlz.no` | Managed outside GCP. `terraform output dns_records` shows what Hosting expects |

## Reading the files

Each file covers one topic:

1. `versions.tf`: Terraform and provider versions, and where state is kept.
2. `variables.tf`: names and IDs, defined once.
3. `project.tf`: the project, Firebase and the APIs.
4. `wif.tf`: how GitHub Actions logs in to GCP without a key. The condition
   uses the repo's and owner's *numeric* IDs, so a rename can't break deploys.
5. `hosting.tf`, `github.tf`, `state.tf`.

`prevent_destroy` marks the project, the repository and the state bucket:
Terraform refuses to plan a destroy for them.

## Daily use

You need `gcloud` logged in as the project owner and `gh` logged in to
GitHub. Terraform comes from `mise.toml` (`mise install`).

```sh
# Credentials only live in the shell session. Nothing is written to disk.
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
export GITHUB_TOKEN="$(gh auth token)"

terraform -chdir=infra init     # once per checkout
terraform -chdir=infra plan     # what would change? (read-only)
terraform -chdir=infra apply    # shows the plan again and asks before changing anything
```

The Google token expires after an hour. Re-run the export if you get a 401.

Apply is run by hand, not in CI. CI only runs `fmt` and `validate` (the
`terraform` check). Running apply in CI would mean giving the deploy service
account rights to change IAM, so it could grant itself anything.

## First-time setup (once)

Everything already existed before this folder did, so it's adopted with the
one-off `import` blocks in `imports.tf` rather than created.

1. **Log in** (on any Mac with the repo checked out on this branch):
   ```sh
   mise install
   gcloud auth login
   gh auth status
   ```
2. **Create the state bucket.** Terraform can't keep state in a bucket that
   doesn't exist yet. `state.tf` imports it and owns its settings afterwards.
   ```sh
   gcloud storage buckets create gs://mlz-no-tfstate \
     --location=europe-west1 --uniform-bucket-level-access \
     --public-access-prevention --project=mlz-no
   ```
3. **Init and plan:**
   ```sh
   export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
   export GITHUB_TOKEN="$(gh auth token)"
   terraform -chdir=infra init
   terraform -chdir=infra plan -out=first.tfplan
   ```
   The plan should contain **imports and in-place updates only**. Expected:
   - `github` WIF provider: the condition switches to numeric IDs and two
     attributes are added to the mapping.
   - A new `deploy_wif` binding on `attribute.repository_id/1218667885`.
   - Bucket: versioning and a lifecycle rule.
   - The repo: `delete_branch_on_merge` becomes `true`.
   - A new `preview` environment.
   - Ruleset: required checks go from `build` to `build`, `terraform`,
     `review dependencies` and `deploy-preview`.

   **Stop if you see `destroy` or `must be replaced`** on the project, the
   pool, the service account, the site or the repo.
4. **Apply exactly that plan:**
   ```sh
   terraform -chdir=infra apply first.tfplan
   rm infra/first.tfplan
   ```
5. **Prove deploys still work:** re-run `deploy-preview` on the Terraform PR,
   or run `gh workflow run gcp-auth-check.yml`. Both log in through the new
   condition.
6. **Remove the old name-based login binding**, which Terraform doesn't
   manage:
   ```sh
   gcloud iam service-accounts remove-iam-policy-binding \
     gh-deploy@mlz-no.iam.gserviceaccount.com --project=mlz-no \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/214692307089/locations/global/workloadIdentityPools/github/attribute.repository/martinzachariassen/mlz-no"
   ```
7. **Delete `imports.tf`**, confirm `terraform -chdir=infra plan` says
   *No changes*, and commit with `chore: drop one-off terraform imports`.
