variable "region" {
  type    = string
  default = "ap-southeast-2"
}

variable "account_emails" {
  description = "Root email for each workload account. Each must be unique and not already used by an AWS account (plus-addressing such as aws+dev@example.com works)."
  type        = map(string)

  validation {
    condition     = toset(keys(var.account_emails)) == toset(["dev", "staging", "production"])
    error_message = "Provide exactly the keys dev, staging and production."
  }
}

variable "billing_alert_email" {
  description = "Where budget alerts go."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly spend across all accounts that triggers an alert."
  type        = number
  default     = 600
}
