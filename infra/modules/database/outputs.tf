output "instance_arn" {
  value = aws_db_instance.this.arn
}

output "instance_id" {
  value = aws_db_instance.this.identifier
}

output "owner_secret_arn" {
  description = "Schema owner login: username, password, url."
  value       = aws_secretsmanager_secret.login["owner"].arn
}

output "app_secret_arn" {
  description = "API login (onetickets_app): username, password, url."
  value       = aws_secretsmanager_secret.login["app"].arn
}

output "address" {
  value = aws_db_instance.this.address
}
