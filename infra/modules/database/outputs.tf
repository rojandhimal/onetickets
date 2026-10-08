output "instance_arn" {
  value = aws_db_instance.this.arn
}

output "instance_id" {
  value = aws_db_instance.this.identifier
}

output "address" {
  value = aws_db_instance.this.address
}

output "port" {
  value = aws_db_instance.this.port
}

output "db_name" {
  value = aws_db_instance.this.db_name
}

output "master_secret_arn" {
  description = "RDS-managed secret holding the owner role's username and password."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "app_user_secret_arn" {
  value = aws_secretsmanager_secret.app_user.arn
}
