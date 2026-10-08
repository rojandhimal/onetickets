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

variable "production_account_id" {
  description = "Production may pull staging's images to promote them."
  type        = string
}
