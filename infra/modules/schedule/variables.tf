variable "name" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "service_arns" {
  description = "Service name to ARN for every service to scale."
  type        = map(string)
}

variable "db_instance_id" {
  type = string
}

variable "db_instance_arn" {
  type = string
}

variable "awake_task_count" {
  type    = number
  default = 1
}

variable "timezone" {
  type    = string
  default = "Australia/Sydney"
}

variable "days" {
  description = "Cron day-of-week field for the days the environment is on."
  type        = string
  default     = "MON-FRI"
}

variable "wake_hour" {
  type    = number
  default = 7

  validation {
    condition     = var.wake_hour >= 1 && var.wake_hour <= 23
    error_message = "wake_hour must be 1 to 23 (the database starts 15 minutes earlier)."
  }
}

variable "wake_minute" {
  type    = number
  default = 0
}

variable "sleep_hour" {
  type    = number
  default = 22

  validation {
    condition     = var.sleep_hour >= 0 && var.sleep_hour <= 22
    error_message = "sleep_hour must be 0 to 22 (the database stops 5 minutes later)."
  }
}

variable "sleep_minute" {
  type    = number
  default = 0
}
