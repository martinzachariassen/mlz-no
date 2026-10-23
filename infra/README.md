# infra/

Everything about how mlz.no is *set up* in Google Cloud and GitHub, written
down as Terraform:
- the project, its APIs, Firebase Hosting and the custom domain
- the keyless deploy login (Workload Identity Federation), plus the deploy
  service account and its roles
- the repository's settings, variables, environments and branch rules

If it's in this folder, change it here and not in a console. A click in the
console shows up as drift in the next `terraform plan`.

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

## The state bucket

Terraform can't keep state in a bucket that doesn't exist yet, so it was
created by hand and `state.tf` took it over afterwards. Needed only to start
over in an empty project:

```sh
gcloud storage buckets create gs://mlz-no-tfstate \
  --location=europe-west1 --uniform-bucket-level-access \
  --public-access-prevention --project=mlz-no
```

## How this was adopted

Everything existed before this folder did, so the first apply (2026-10-23)
imported it with one-off `import` blocks instead of creating it. The blocks
were deleted afterwards; they are in git history (`infra/imports.tf` in
`0f2e841`). Two things were done by hand because Terraform doesn't manage
them: creating the state bucket, and removing the old name-based
`roles/iam.workloadIdentityUser` binding (it matched on the repo *name*, so a
rename would have broken deploys; the managed one matches the numeric ID).
