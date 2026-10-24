variable "environment" {
  description = "staging or production. Also the GitHub environment name."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "github_repository" {
  type    = string
  default = "rojandhimal/onetickets"
}

variable "vpc_cidr" {
  type = string
}

variable "nat_gateways" {
  description = "0, 1 or 2. With 0, app tasks run in public subnets with public IPs."
  type        = number
  default     = 1
}

variable "use_spot" {
  description = "Run services on Fargate Spot."
  type        = bool
  default     = false
}

variable "container_insights" {
  type    = bool
  default = true
}

variable "power_schedule" {
  description = "Turn the environment off out of hours (Sydney time). null keeps it on all the time and enables API autoscaling instead."
  type = object({
    wake_hour  = number
    sleep_hour = number
    days       = string
  })
  default = null
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "web_hostname" {
  type = string
}

variable "api_hostname" {
  type = string
}

variable "email_domain" {
  description = "Domain the app sends email from."
  type        = string
}

variable "behind_cloudflare" {
  description = "Cloudflare proxies the hostnames (infra/edge). See modules/app."
  type        = bool
  default     = true
}

variable "ingress_cidrs" {
  description = "IPv4 ranges that may reach the load balancer when behind_cloudflare is false."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ingress_ipv6_cidrs" {
  description = "IPv6 ranges that may reach the load balancer when behind_cloudflare is false (if the ALB is switched to dualstack)."
  type        = list(string)
  default     = []
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
  default = ["node", "dist/database/migrate.js"]
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

variable "api_sentry_dsn" {
  type    = string
  default = ""
}

variable "magic_link_hourly_cap" {
  type    = number
  default = 300
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

variable "banner_storage" {
  description = "Where the API keeps event banners: local or s3. See modules/app."
  type        = string
  default     = "local"
}

variable "ticket_signing_key_generations" {
  description = "Ticket-signing key generations, oldest first; the last one signs. Add one to rotate (see infra/README.md)."
  type        = list(string)
  default     = ["2026-10"]
}
