variable "zone_id" {
  description = "Cloudflare zone id of the domain (Overview page in the Cloudflare dashboard)."
  type        = string
}

variable "state_bucket" {
  description = "Terraform state bucket, the same value as in envs/backend.hcl."
  type        = string
}

variable "environments" {
  description = "Environments that are applied and should be put behind Cloudflare. Add production once its stack exists."
  type        = set(string)
  default     = ["staging"]

  validation {
    condition     = length(var.environments) > 0 && length(setsubtract(var.environments, ["staging", "production"])) == 0
    error_message = "List at least one of staging and production."
  }
}

variable "cloudflare_plan" {
  description = "The zone's Cloudflare plan, which decides how many rate limiting rules there are and how long they can count: free (one rule, 10 s) or pro (two rules, up to a minute)."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "pro"], var.cloudflare_plan)
    error_message = "cloudflare_plan is free or pro."
  }
}
