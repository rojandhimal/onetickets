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

variable "task_subnet_ids" {
  description = "Subnets the app tasks run in: private when the VPC has NAT, public otherwise."
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Give tasks public IPs, so they reach ECR, Secrets Manager and SES without a NAT gateway. Inbound is still only from the load balancer."
  type        = bool
  default     = false
}

variable "use_spot" {
  type    = bool
  default = false
}

variable "container_insights" {
  type    = bool
  default = true
}

variable "enable_autoscaling" {
  description = "Scale the API on CPU. Off where a schedule sets the task count, so the two don't fight."
  type        = bool
  default     = true
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
  description = "Liveness only: a database blip must not make every task fail its load balancer check."
  type        = string
  default     = "/health/live"
}

variable "api_trust_proxy_hops" {
  description = "Proxies that append to X-Forwarded-For before the API: the load balancer (the web app's /api rewrite forwards it unchanged). Set to 2 once Cloudflare proxies the hostnames. Too high lets clients spoof their IP past rate limits."
  type        = number
  default     = 1
}

variable "api_sentry_dsn" {
  description = "Sentry DSN for the API. Empty turns Sentry off. Not secret: it only allows sending events."
  type        = string
  default     = ""
}

variable "api_log_level" {
  type    = string
  default = "info"
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
