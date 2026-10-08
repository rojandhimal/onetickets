module "environment" {
  source = "../../modules/environment"

  environment  = "dev"
  vpc_cidr     = "10.10.0.0/16"
  web_hostname = "dev.${var.domain}"
  api_hostname = "api.dev.${var.domain}"
  alert_email  = var.alert_email
  email_domain = "dev.${var.domain}"

  db_instance_class        = "db.t4g.micro"
  db_backup_retention_days = 1
  log_retention_days       = 7
  enable_execute_command   = true
}
