variable "account_id" {
  description = "AWS account id for this environment (from infra/organization outputs)."
  type        = string
}

variable "domain" {
  description = "Apex domain whose DNS is in Cloudflare, e.g. onetickets.com.au."
  type        = string
}

variable "sentry_api_dsn" {
  description = "Sentry DSN for the API in this environment. Leave empty until the Sentry project exists."
  type        = string
  default     = ""
}

variable "magic_link_hourly_cap" {
  description = "Sign-in emails the service may send in a rolling hour (MAGIC_LINK_HOURLY_CAP). Well above expected launch peak; revisit from the Sprint 9 load test and SES sending limits."
  type        = number
  default     = 1000
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "staging_account_id" {
  description = "Releases promote images from staging's repositories."
  type        = string
}
