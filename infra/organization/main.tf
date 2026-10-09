# Runs once, in the AWS Organizations management account, with an admin
# identity. Creates the staging and production accounts and the Terraform state bucket
# that every environment stack uses. See infra/README.md for the order.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Local state on first apply (the bucket does not exist yet). After the first
  # apply, uncomment this block and run `terraform init -migrate-state`.
  # backend "s3" {
  #   bucket       = "onetickets-tfstate-<management account id>"
  #   key          = "organization/terraform.tfstate"
  #   region       = "ap-southeast-2"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "onetickets"
      ManagedBy = "terraform"
      Stack     = "organization"
    }
  }
}

data "aws_caller_identity" "current" {}

# If the management account already has an organization, import it first:
#   terraform import aws_organizations_organization.this <o-xxxxxxxxxx>
resource "aws_organizations_organization" "this" {
  feature_set = "ALL"

  aws_service_access_principals = [
    "cloudtrail.amazonaws.com",
    "sso.amazonaws.com",
  ]
}

resource "aws_organizations_organizational_unit" "workloads" {
  name      = "workloads"
  parent_id = aws_organizations_organization.this.roots[0].id
}

# Each member account gets OrganizationAccountAccessRole, which the management
# account assumes to apply the environment stacks.
resource "aws_organizations_account" "env" {
  for_each = var.account_emails

  name      = "onetickets-${each.key}"
  email     = each.value
  parent_id = aws_organizations_organizational_unit.workloads.id
  role_name = "OrganizationAccountAccessRole"

  # Closing an AWS account is slow and hard to undo; never let a plan do it.
  close_on_deletion = false

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [role_name]
  }
}

# Organization-wide trail so every account's API activity is kept centrally.
resource "aws_cloudtrail" "org" {
  name                          = "onetickets-org"
  s3_bucket_name                = aws_s3_bucket.audit.id
  is_organization_trail         = true
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true

  depends_on = [aws_s3_bucket_policy.audit]
}

# Monthly spend alert, so a forgotten resource is noticed early.
resource "aws_budgets_budget" "monthly" {
  name         = "onetickets-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.billing_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.billing_alert_email]
  }
}
