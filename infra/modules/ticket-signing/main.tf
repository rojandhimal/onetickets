# The key that signs QR tickets (ADR 0011): Ed25519 in KMS, one per
# environment, and a task role for the signing worker that is the only
# principal able to sign with it. The key policy, not just IAM, keeps signing
# to that role: the account root gets no kms:Sign, so no IAM policy on the api
# or anywhere else can grant it.
#
# KMS can't rotate asymmetric keys, so rotation is a new generation: add one to
# var.generations and the last becomes the active signing key. Older
# generations stay for GetPublicKey only, so the scanner can still verify
# tickets signed with them until they are reissued.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  active = var.generations[length(var.generations) - 1]
}

resource "aws_kms_key" "ticket_signing" {
  for_each = toset(var.generations)

  description              = "${var.name} ticket signing (${each.key})"
  customer_master_key_spec = "ECC_NIST_EDWARDS25519"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 30
  policy                   = data.aws_iam_policy_document.key[each.key].json
}

resource "aws_kms_alias" "generation" {
  for_each = toset(var.generations)

  name          = "alias/${var.name}-ticket-signing-${each.key}"
  target_key_id = aws_kms_key.ticket_signing[each.key].key_id
}

# What the signing worker uses. Moving it to a new generation is the rotation.
resource "aws_kms_alias" "active" {
  name          = "alias/${var.name}-ticket-signing"
  target_key_id = aws_kms_key.ticket_signing[local.active].key_id
}

data "aws_iam_policy_document" "key" {
  for_each = toset(var.generations)

  # Everything the account needs to manage the key, but not kms:Sign.
  statement {
    sid = "AccountAdmin"
    actions = [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:Revoke*",
      "kms:Disable*",
      "kms:Get*",
      "kms:Delete*",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ScheduleKeyDeletion",
      "kms:CancelKeyDeletion",
      "kms:Verify",
    ]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid       = "SignerPublicKey"
    actions   = ["kms:GetPublicKey"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.signer.arn]
    }
  }

  # Only the active generation signs, and only pure Ed25519 over the raw
  # message, which is what the ticket format uses.
  dynamic "statement" {
    for_each = each.key == local.active ? [1] : []
    content {
      sid       = "SignerSign"
      actions   = ["kms:Sign"]
      resources = ["*"]
      principals {
        type        = "AWS"
        identifiers = [aws_iam_role.signer.arn]
      }
      condition {
        test     = "StringEquals"
        variable = "kms:SigningAlgorithm"
        values   = ["ED25519_SHA_512"]
      }
      condition {
        test     = "StringEquals"
        variable = "kms:MessageType"
        values   = ["RAW"]
      }
    }
  }
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# Task role for the signing worker. There is no ECS service for it yet; the
# worker's task definition will name this role, and the deploy role's
# pass_role_arns gains it then.
resource "aws_iam_role" "signer" {
  name               = "${var.name}-ticket-signer"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "signer" {
  statement {
    actions   = ["kms:Sign"]
    resources = [aws_kms_key.ticket_signing[local.active].arn]
  }
  statement {
    actions   = ["kms:GetPublicKey"]
    resources = [for key in aws_kms_key.ticket_signing : key.arn]
  }
}

resource "aws_iam_role_policy" "signer" {
  role   = aws_iam_role.signer.id
  policy = data.aws_iam_policy_document.signer.json
}
