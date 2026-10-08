output "deploy_role_arn" {
  description = "Set as AWS_DEPLOY_ROLE_ARN on the matching GitHub environment."
  value       = module.deploy_role.role_arn
}

output "cluster_name" {
  value = module.app.cluster_name
}

output "ecr_repository_urls" {
  value = module.app.ecr_repository_urls
}

output "ecr_repository_arns" {
  value = module.app.ecr_repository_arns
}

output "load_balancer_dns_name" {
  value = module.app.load_balancer_dns_name
}

output "certificate_validation_records" {
  value = module.app.certificate_validation_records
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "task_security_group_id" {
  value = module.app.task_security_group_id
}

output "uploads_bucket" {
  value = module.app.uploads_bucket
}

output "db_address" {
  value = module.database.address
}

output "db_instance_arn" {
  value = module.database.instance_arn
}
