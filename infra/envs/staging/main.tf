module "environment" {
  source = "../../modules/environment"

  environment  = "staging"
  vpc_cidr     = "10.20.0.0/16"
  web_hostname = "staging.${var.domain}"
  api_hostname = "api.staging.${var.domain}"
  alert_email  = var.alert_email
  email_domain = "staging.${var.domain}"

  db_instance_class        = "db.t4g.small"
  db_backup_retention_days = 7
  log_retention_days       = 30
  enable_execute_command   = true

  ecr_pull_account_ids = [var.production_account_id]
}
