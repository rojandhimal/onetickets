variable "environment" {
  description = "dev, staging or production. Also the GitHub environment name."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging or production."
  }
}

variable "github_repository" {
  type    = string
  default = "rojandhimal/onetickets"
}

variable "vpc_cidr" {
  type = string
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "web_hostname" {
  type = string
}

variable "api_hostname" {
  type = string
}

variable "ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "db_instance_class" {
  type = string
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "migrate_command" {
  type    = list(string)
  default = ["node", "dist/migrate.js"]
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "api_max_count" {
  type    = number
  default = 2
}

variable "web_desired_count" {
  type    = number
  default = 1
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "enable_execute_command" {
  type    = bool
  default = false
}

variable "ecr_pull_account_ids" {
  description = "Accounts allowed to pull this environment's images (set on staging to the production account)."
  type        = list(string)
  default     = []
}

variable "ecr_source_repository_arns" {
  description = "Staging repositories production promotes images from."
  type        = list(string)
  default     = []
}

variable "alert_email" {
  description = "Where CloudWatch alarms are emailed. Empty means no subscription."
  type        = string
  default     = ""
}
