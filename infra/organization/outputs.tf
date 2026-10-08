output "account_ids" {
  description = "Paste these into infra/envs/<env>/terraform.tfvars and the GitHub environment variables."
  value       = { for k, a in aws_organizations_account.env : k => a.id }
}

output "state_bucket" {
  value = aws_s3_bucket.tfstate.id
}
