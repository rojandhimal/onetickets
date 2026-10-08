module "environment" {
  source = "../../modules/environment"

  environment  = "production"
  vpc_cidr     = "10.30.0.0/16"
  web_hostname = var.domain
  api_hostname = "api.${var.domain}"
  alert_email  = var.alert_email

  single_nat_gateway = false

  # Sized for launch traffic; resize from the Sprint 9 load test.
  db_instance_class        = "db.t4g.medium"
  db_allocated_storage_gb  = 50
  db_multi_az              = true
  db_backup_retention_days = 14

  api_desired_count = 2
  api_max_count     = 6
  web_desired_count = 2

  log_retention_days  = 90
  deletion_protection = true

  ecr_source_repository_arns = [
    for app in ["api", "web"] :
    "arn:aws:ecr:ap-southeast-2:${var.staging_account_id}:repository/onetickets/${app}"
  ]
}

# Copy automated backups to Melbourne so a Sydney region outage cannot take
# the only copy of orders and money (architecture: daily copy to a second
# region).
provider "aws" {
  alias  = "melbourne"
  region = "ap-southeast-4"

  assume_role {
    role_arn = "arn:aws:iam::${var.account_id}:role/OrganizationAccountAccessRole"
  }

  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project     = "onetickets"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

resource "aws_kms_key" "backup_replica" {
  provider = aws.melbourne

  description         = "onetickets-production backup replica"
  enable_key_rotation = true
}

resource "aws_db_instance_automated_backups_replication" "melbourne" {
  provider = aws.melbourne

  source_db_instance_arn = module.environment.db_instance_arn
  kms_key_id             = aws_kms_key.backup_replica.arn
  retention_period       = 14
}
