variable "account_id" {
  description = "AWS account id for this environment (from infra/organization outputs)."
  type        = string
}

variable "domain" {
  description = "Apex domain whose DNS is in Cloudflare, e.g. onetickets.com.au."
  type        = string
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "staging_account_id" {
  description = "Releases promote images from staging's repositories."
  type        = string
}
