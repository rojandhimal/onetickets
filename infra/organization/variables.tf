variable "region" {
  type    = string
  default = "ap-southeast-2"
}

variable "account_emails" {
  description = "Root email for each workload account. Each must be unique and not already used by an AWS account (plus-addressing such as aws+staging@example.com works)."
  type        = map(string)

  validation {
    condition     = toset(keys(var.account_emails)) == toset(["staging", "production"])
    error_message = "Provide exactly the keys staging and production."
  }
}

variable "billing_alert_email" {
  description = "Where budget alerts go."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly spend across all accounts that triggers an alert."
  type        = number
  default     = 450
}
