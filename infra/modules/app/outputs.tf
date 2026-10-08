output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "service_names" {
  value = { for k, s in aws_ecs_service.app : k => s.name }
}

output "ecr_repository_arns" {
  value = { for k, r in aws_ecr_repository.app : k => r.arn }
}

output "ecr_repository_urls" {
  value = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "task_security_group_id" {
  value = aws_security_group.tasks.id
}

output "private_subnet_ids" {
  value = var.private_subnet_ids
}

output "execution_role_arn" {
  value = aws_iam_role.execution.arn
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "load_balancer_dns_name" {
  description = "Point the web and API hostnames at this (CNAME in Cloudflare)."
  value       = aws_lb.this.dns_name
}

output "load_balancer_arn_suffix" {
  value = aws_lb.this.arn_suffix
}

output "target_group_arn_suffixes" {
  value = { for k, tg in aws_lb_target_group.app : k => tg.arn_suffix }
}

output "certificate_validation_records" {
  description = "CNAME records to add in Cloudflare (DNS only, not proxied) so ACM can issue the certificate."
  value = {
    for o in aws_acm_certificate.this.domain_validation_options : o.domain_name => {
      name  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  }
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.id
}
