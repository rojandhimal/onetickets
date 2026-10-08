variable "name" {
  description = "Prefix for resource names, e.g. onetickets-staging."
  type        = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "kms_key_arn" {
  type = string
}

variable "web_hostname" {
  description = "Public hostname for the Next.js site, e.g. staging.onetickets.com.au."
  type        = string
}

variable "api_hostname" {
  description = "Public hostname for the API, e.g. api.staging.onetickets.com.au."
  type        = string
}

variable "ingress_cidrs" {
  description = "Who may reach the load balancer. Narrow to Cloudflare's IP ranges once DNS is proxied."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "db_address" {
  type = string
}

variable "db_owner_secret_arn" {
  type = string
}

variable "db_app_secret_arn" {
  type = string
}

variable "migrate_command" {
  description = "Container command that applies database migrations and exits 0 on success."
  type        = list(string)
  default     = ["node", "dist/database/migrate.js"]
}

variable "api_health_check_path" {
  type    = string
  default = "/health"
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "api_max_count" {
  type    = number
  default = 2
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
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
  description = "Allow `aws ecs execute-command` shells into tasks. Off in production."
  type        = bool
  default     = false
}

variable "ecr_pull_account_ids" {
  description = "Other AWS accounts allowed to pull this environment's images (staging grants production)."
  type        = list(string)
  default     = []
}

variable "ses_identity_arn" {
  type = string
}

variable "email_domain" {
  type = string
}

variable "psql_image" {
  description = "Image with psql, used by the db-roles task."
  type        = string
  default     = "public.ecr.aws/docker/library/postgres:16-alpine"
}
