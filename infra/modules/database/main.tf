# RDS PostgreSQL 16 in the private subnets, plus two connection secrets:
#   owner    the schema owner (RDS master). Only the migrate and db-roles
#            tasks get it.
#   app      the API's own login, `onetickets_app`, granted the `ot_app`
#            group role the migrations create. It does not own the tables, so
#            row-level security applies to it (architecture review fix 11).
# Each secret holds username, password and a ready-made `url`, because the
# API reads DATABASE_URL and migrations read MIGRATION_DATABASE_URL.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  performance_insights = !can(regex("\\.(micro|small)$", var.instance_class))
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "db" {
  name        = "${var.name}-db"
  description = "Postgres, reachable only from the app tasks"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "this" {
  identifier     = var.name
  engine         = "postgres"
  engine_version = var.engine_version

  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.allocated_storage_gb * 5
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  db_name  = "onetickets"
  username = "onetickets_owner"
  password = random_password.owner.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false
  multi_az               = var.multi_az

  backup_retention_period  = var.backup_retention_days
  backup_window            = "15:00-16:00" # 01:00-02:00 Sydney (AEST)
  maintenance_window       = "sun:16:30-sun:17:30"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  # Performance Insights is not offered on the smallest burstable classes.
  performance_insights_enabled    = local.performance_insights
  performance_insights_kms_key_id = local.performance_insights ? var.kms_key_arn : null
  enabled_cloudwatch_logs_exports = ["postgresql"]

  auto_minor_version_upgrade = true
  deletion_protection        = var.deletion_protection
  skip_final_snapshot        = !var.deletion_protection
  final_snapshot_identifier  = var.deletion_protection ? "${var.name}-final" : null

  lifecycle {
    ignore_changes = [engine_version] # minor upgrades happen in place
  }
}

locals {
  # libpq semantics for node-postgres: encrypt, without verifying the RDS CA
  # (which Node does not trust by default). Switch to verify-full once the
  # image ships the RDS CA bundle.
  url_params = "sslmode=require&uselibpqcompat=true"

  logins = {
    owner = { username = "onetickets_owner", password = random_password.owner.result }
    app   = { username = "onetickets_app", password = random_password.app.result }
  }
}

# Letters and digits only, so the passwords need no escaping in URLs or SQL.
resource "random_password" "owner" {
  length  = 40
  special = false
}

resource "random_password" "app" {
  length  = 40
  special = false
}

resource "aws_secretsmanager_secret" "login" {
  for_each = local.logins

  name                    = "${var.name}/db-${each.key}"
  description             = "Postgres login ${each.value.username}"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "login" {
  for_each = local.logins

  secret_id = aws_secretsmanager_secret.login[each.key].id
  secret_string = jsonencode({
    username = each.value.username
    password = each.value.password
    url      = "postgres://${each.value.username}:${each.value.password}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${aws_db_instance.this.db_name}?${local.url_params}"
  })
}
