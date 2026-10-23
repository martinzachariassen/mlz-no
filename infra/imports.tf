# One-off: adopts what was created by hand before this repo used Terraform.
# Delete this file once `terraform apply` has run.

locals {
  deploy_sa = "gh-deploy@mlz-no.iam.gserviceaccount.com"
}

import {
  to = google_project.this
  id = "mlz-no"
}

import {
  to = google_firebase_project.this
  id = "projects/mlz-no"
}

import {
  for_each = local.services
  to       = google_project_service.this[each.value]
  id       = "mlz-no/${each.value}"
}

import {
  to = google_storage_bucket.tfstate
  id = "mlz-no-tfstate"
}

import {
  to = google_iam_workload_identity_pool.github
  id = "projects/mlz-no/locations/global/workloadIdentityPools/github"
}

import {
  to = google_iam_workload_identity_pool_provider.github
  id = "projects/mlz-no/locations/global/workloadIdentityPools/github/providers/github"
}

import {
  to = google_service_account.deploy
  id = "projects/mlz-no/serviceAccounts/${local.deploy_sa}"
}

import {
  for_each = local.deploy_roles
  to       = google_project_iam_member.deploy[each.value]
  id       = "mlz-no ${each.value} serviceAccount:${local.deploy_sa}"
}

import {
  to = google_firebase_hosting_site.default
  id = "projects/mlz-no/sites/mlz-no"
}

import {
  to = google_firebase_hosting_custom_domain.apex
  id = "projects/mlz-no/sites/mlz-no/customDomains/mlz.no"
}

import {
  to = github_repository.this
  id = "mlz-no"
}

import {
  to = github_repository_vulnerability_alerts.this
  id = "mlz-no"
}

import {
  to = github_actions_variable.wif_provider
  id = "mlz-no:GCP_WORKLOAD_IDENTITY_PROVIDER"
}

import {
  to = github_actions_variable.deploy_sa
  id = "mlz-no:GCP_SERVICE_ACCOUNT"
}

import {
  to = github_repository_environment.this["production"]
  id = "mlz-no:production"
}

import {
  to = github_repository_ruleset.main
  id = "mlz-no:18976150"
}
