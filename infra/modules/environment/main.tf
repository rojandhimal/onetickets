# One complete OneTickets environment in one AWS account. The env roots under
# infra/envs only choose sizes and names; everything else is the same in
# staging and production so staging is a faithful rehearsal.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

locals {
  name = "onetickets-${var.environment}"
}

data "aws_caller_identity" "current" {}

# One customer-managed key per environment for the database, secrets, logs,
# images and uploads.
resource "aws_kms_key" "main" {
  description             = "${local.name} data at rest"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

data "aws_region" "current" {}

data "aws_iam_policy_document" "kms" {
  statement {
    sid       = "AccountAdmin"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  # CloudWatch Logs encrypts log groups with this key.
  statement {
    sid = "CloudWatchLogs"
    actions = [
      "kms:Encrypt*",
      "kms:Decrypt*",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:Describe*",
    ]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${data.aws_region.current.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:log-group:/onetickets/*"]
    }
  }
}

module "network" {
  source = "../network"

  name         = local.name
  cidr_block   = var.vpc_cidr
  nat_gateways = var.nat_gateways
}

locals {
  # Without NAT, tasks need public IPs to reach AWS APIs and the internet.
  tasks_public = !module.network.has_nat
}

module "database" {
  source = "../database"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [module.app.task_security_group_id]
  kms_key_arn                = aws_kms_key.main.arn
  instance_class             = var.db_instance_class
  allocated_storage_gb       = var.db_allocated_storage_gb
  multi_az                   = var.db_multi_az
  backup_retention_days      = var.db_backup_retention_days
  deletion_protection        = var.deletion_protection
}

module "app" {
  source = "../app"

  name                   = local.name
  environment            = var.environment
  vpc_id                 = module.network.vpc_id
  public_subnet_ids      = module.network.public_subnet_ids
  task_subnet_ids        = local.tasks_public ? module.network.public_subnet_ids : module.network.private_subnet_ids
  assign_public_ip       = local.tasks_public
  use_spot               = var.use_spot
  container_insights     = var.container_insights
  enable_autoscaling     = var.power_schedule == null
  api_cpu                = var.api_cpu
  api_memory             = var.api_memory
  web_cpu                = var.web_cpu
  web_memory             = var.web_memory
  kms_key_arn            = aws_kms_key.main.arn
  web_hostname           = var.web_hostname
  api_hostname           = var.api_hostname
  ingress_cidrs          = var.ingress_cidrs
  db_address             = module.database.address
  db_owner_secret_arn    = module.database.owner_secret_arn
  db_app_secret_arn      = module.database.app_secret_arn
  migrate_command        = var.migrate_command
  api_desired_count      = var.api_desired_count
  api_max_count          = var.api_max_count
  web_desired_count      = var.web_desired_count
  log_retention_days     = var.log_retention_days
  deletion_protection    = var.deletion_protection
  enable_execute_command = var.enable_execute_command
  ecr_pull_account_ids   = var.ecr_pull_account_ids
  ses_identity_arn       = module.email.identity_arn
  email_domain           = var.email_domain
}

module "power_schedule" {
  source = "../schedule"
  count  = var.power_schedule == null ? 0 : 1

  name            = local.name
  cluster_name    = module.app.cluster_name
  service_arns    = module.app.service_arns
  db_instance_id  = module.database.instance_id
  db_instance_arn = module.database.instance_arn
  wake_hour       = var.power_schedule.wake_hour
  sleep_hour      = var.power_schedule.sleep_hour
  days            = var.power_schedule.days
}

module "email" {
  source = "../email"

  domain             = var.email_domain
  dmarc_report_email = var.alert_email
}

module "deploy_role" {
  source = "../github-deploy-role"

  environment                = var.environment
  github_repository          = var.github_repository
  github_environment         = var.environment
  ecr_repository_arns        = values(module.app.ecr_repository_arns)
  ecr_source_repository_arns = var.ecr_source_repository_arns
  pass_role_arns             = [module.app.execution_role_arn, module.app.task_role_arn]
  cluster_name               = module.app.cluster_name
  cluster_arn                = module.app.cluster_arn
  db_instance_arn            = module.database.instance_arn
}

module "alarms" {
  source = "../alarms"

  name                      = local.name
  alert_email               = var.alert_email
  load_balancer_arn_suffix  = module.app.load_balancer_arn_suffix
  target_group_arn_suffixes = module.app.target_group_arn_suffixes
  db_instance_id            = module.database.instance_id
}
