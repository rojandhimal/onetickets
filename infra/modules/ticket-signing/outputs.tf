output "signer_role_arn" {
  description = "Task role for the signing worker."
  value       = aws_iam_role.signer.arn
}

output "active_key_arn" {
  value = aws_kms_key.ticket_signing[local.active].arn
}

output "active_alias" {
  description = "Alias the signing worker signs with."
  value       = aws_kms_alias.active.name
}

output "key_arns" {
  description = "Every generation's key, for GetPublicKey."
  value       = { for g, key in aws_kms_key.ticket_signing : g => key.arn }
}
