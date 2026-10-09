# Turns an environment off out of hours and back on in the morning, using
# EventBridge Scheduler's built-in AWS API targets (no Lambda): services go to
# zero tasks and the database stops. While off, only storage, the load
# balancer and a few small fixed charges are billed.
#
# A stopped RDS instance restarts by itself after 7 days; the next scheduled
# stop puts it back down. `infra/scripts/power.sh` and the Deploy workflow
# wake the environment outside these hours.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

locals {
  # The database needs a few minutes to start, so it wakes 15 minutes before
  # the services and stops 5 minutes after them.
  db_start = var.wake_hour * 60 + var.wake_minute - 15
  db_stop  = var.sleep_hour * 60 + var.sleep_minute + 5
  db_actions = {
    start = { action = "startDBInstance", cron = "cron(${local.db_start % 60} ${floor(local.db_start / 60)} ? * ${var.days} *)" }
    stop  = { action = "stopDBInstance", cron = "cron(${local.db_stop % 60} ${floor(local.db_stop / 60)} ? * ${var.days} *)" }
  }

  service_actions = merge(
    { for s, arn in var.service_arns : "${s}-wake" => { arn = arn, count = var.awake_task_count, cron = "cron(${var.wake_minute} ${var.wake_hour} ? * ${var.days} *)" } },
    { for s, arn in var.service_arns : "${s}-sleep" => { arn = arn, count = 0, cron = "cron(${var.sleep_minute} ${var.sleep_hour} ? * ${var.days} *)" } },
  )
}

resource "aws_scheduler_schedule_group" "this" {
  name = "${var.name}-power"
}

resource "aws_scheduler_schedule" "db" {
  for_each = local.db_actions

  name                         = "db-${each.key}"
  group_name                   = aws_scheduler_schedule_group.this.name
  schedule_expression          = each.value.cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:${each.value.action}"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ DbInstanceIdentifier = var.db_instance_id })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }
}

resource "aws_scheduler_schedule" "service" {
  for_each = local.service_actions

  name                         = each.key
  group_name                   = aws_scheduler_schedule_group.this.name
  schedule_expression          = each.value.cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ecs:updateService"
    role_arn = aws_iam_role.scheduler.arn
    input = jsonencode({
      Cluster      = var.cluster_name
      Service      = each.value.arn
      DesiredCount = each.value.count
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name}-power-schedule"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    actions   = ["rds:StartDBInstance", "rds:StopDBInstance"]
    resources = [var.db_instance_arn]
  }
  statement {
    actions   = ["ecs:UpdateService"]
    resources = values(var.service_arns)
  }
}

resource "aws_iam_role_policy" "scheduler" {
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}
