variable "project_id" {
  description = "GCP/Firebase project. Fixed: project IDs can't be renamed."
  type        = string
  default     = "mlz-no"
}

variable "project_name" {
  description = "Display name of the GCP project."
  type        = string
  default     = "mlz-no"
}

variable "region" {
  description = "Region for regional resources (the state bucket)."
  type        = string
  default     = "europe-west1"
}

variable "github_owner" {
  description = "GitHub user that owns the repository."
  type        = string
  default     = "martinzachariassen"
}

variable "github_repo" {
  description = "Repository name (without owner)."
  type        = string
  default     = "mlz-no"
}

variable "domain" {
  description = "Custom domain served by Firebase Hosting."
  type        = string
  default     = "mlz.no"
}
