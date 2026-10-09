variable "environment" {
  type = string
}

variable "github_repository" {
  description = "owner/name of the repository allowed to deploy."
  type        = string
}

variable "github_environment" {
  description = "GitHub environment whose jobs may assume the role."
  type        = string
}

variable "ecr_repository_arns" {
  type = list(string)
}

variable "ecr_source_repository_arns" {
  description = "Repositories in another account to pull from when promoting an image."
  type        = list(string)
  default     = []
}

variable "pass_role_arns" {
  description = "ECS execution and task roles the deploy may hand to new task definitions."
  type        = list(string)
}

variable "cluster_name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "db_instance_arn" {
  type = string
}
