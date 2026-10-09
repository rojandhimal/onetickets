variable "name" {
  type = string
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "load_balancer_arn_suffix" {
  type = string
}

variable "target_group_arn_suffixes" {
  type = map(string)
}

variable "db_instance_id" {
  type = string
}
