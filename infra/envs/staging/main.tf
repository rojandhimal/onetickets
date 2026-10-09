module "environment" {
  source = "../../modules/environment"

  environment  = "staging"
  vpc_cidr     = "10.20.0.0/16"
  web_hostname = "staging.${var.domain}"
  api_hostname = "api.staging.${var.domain}"
  alert_email  = var.alert_email
  email_domain = "staging.${var.domain}"

  # Kept as small as a real URL, real email and real webhooks allow: no NAT
  # gateway (tasks get public IPs, inbound still only from the load
  # balancer), Spot tasks, the smallest database, and everything off outside
  # weekday working hours. Deploys and infra/scripts/power.sh wake it.
  nat_gateways       = 0
  use_spot           = true
  container_insights = false
  power_schedule = {
    wake_hour  = 7
    sleep_hour = 22
    days       = "MON-FRI"
  }

  api_cpu    = 256
  api_memory = 512
  web_cpu    = 256
  web_memory = 512

  db_instance_class        = "db.t4g.micro"
  db_backup_retention_days = 1
  log_retention_days       = 14
  enable_execute_command   = true

  ecr_pull_account_ids = [var.production_account_id]
}
