output "deploy_role_arn" {
  value = module.environment.deploy_role_arn
}

output "cluster_name" {
  value = module.environment.cluster_name
}

output "ecr_repository_urls" {
  value = module.environment.ecr_repository_urls
}

output "load_balancer_dns_name" {
  value = module.environment.load_balancer_dns_name
}

output "certificate_validation_records" {
  value = module.environment.certificate_validation_records
}

output "private_subnet_ids" {
  value = module.environment.private_subnet_ids
}

output "task_security_group_id" {
  value = module.environment.task_security_group_id
}
