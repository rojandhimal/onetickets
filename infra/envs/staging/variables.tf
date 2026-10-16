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
  description = "Sign-in emails the service may send in a rolling hour (MAGIC_LINK_HOURLY_CAP). Testers only, so the API default."
  type        = number
  default     = 300
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "production_account_id" {
  description = "Production may pull staging's images to promote them."
  type        = string
}
