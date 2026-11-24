data "github_user" "owner" {
  username = var.github_owner
}

resource "github_repository" "this" {
  name         = var.github_repo
  description  = "Personal homepage for mlz.no. One static page on Firebase Hosting, with the setup (GCP, domain, keyless GitHub deploy) as Terraform."
  homepage_url = "https://${var.domain}"
  visibility   = "public"
  topics = [
    "content-security-policy", "firebase-hosting", "github-actions",
    "infrastructure-as-code", "no-build", "personal-website",
    "security-headers", "static-site", "terraform", "workload-identity-federation",
  ]

  has_issues      = true
  has_projects    = false
  has_wiki        = false
  has_discussions = false

  # Matches the ruleset below: linear history, squash or rebase only.
  allow_merge_commit     = false
  allow_squash_merge     = true
  allow_rebase_merge     = true
  allow_auto_merge       = false
  allow_update_branch    = true # "Update branch" button; checks must be up to date
  delete_branch_on_merge = true

  squash_merge_commit_title   = "COMMIT_OR_PR_TITLE"
  squash_merge_commit_message = "COMMIT_MESSAGES"

  security_and_analysis {
    secret_scanning {
      status = "enabled"
    }
    secret_scanning_push_protection {
      status = "enabled"
    }
  }

  archive_on_destroy = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "github_repository_vulnerability_alerts" "this" {
  repository = github_repository.this.name
  enabled    = true
}

resource "github_actions_variable" "wif_provider" {
  repository    = github_repository.this.name
  variable_name = "GCP_WORKLOAD_IDENTITY_PROVIDER"
  value         = google_iam_workload_identity_pool_provider.github.name
}

resource "github_actions_variable" "deploy_sa" {
  repository    = github_repository.this.name
  variable_name = "GCP_SERVICE_ACCOUNT"
  value         = google_service_account.deploy.email
}

resource "github_repository_environment" "preview" {
  repository  = github_repository.this.name
  environment = "preview"
}

# Only main may deploy to production, even from a workflow on another branch.
resource "github_repository_environment" "production" {
  repository  = github_repository.this.name
  environment = "production"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "production_main" {
  repository     = github_repository.this.name
  environment    = github_repository_environment.production.environment
  branch_pattern = "main"
}

moved {
  from = github_repository_environment.this["preview"]
  to   = github_repository_environment.preview
}

moved {
  from = github_repository_environment.this["production"]
  to   = github_repository_environment.production
}

resource "github_repository_ruleset" "main" {
  name        = "main-protection-solo"
  repository  = github_repository.this.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = 5 # built-in "Admin" repository role
    actor_type  = "RepositoryRole"
    bypass_mode = "always"
  }

  rules {
    deletion                = true
    non_fast_forward        = true
    required_linear_history = true
    required_signatures     = true

    pull_request {
      required_approving_review_count   = 0
      dismiss_stale_reviews_on_push     = true
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_review_thread_resolution = true
      allowed_merge_methods             = ["squash", "rebase"]
    }

    required_status_checks {
      strict_required_status_checks_policy = true

      # integration_id stops other apps satisfying a check by posting its name.
      dynamic "required_check" {
        for_each = toset([
          "build",
          "terraform",
          "review dependencies",
          "deploy-preview",
        ])
        content {
          context        = required_check.value
          integration_id = 15368 # GitHub Actions
        }
      }
    }
  }
}
