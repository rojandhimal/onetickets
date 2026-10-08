# Amazon SES sending domain with DKIM, an aligned custom MAIL FROM (SPF) and a
# DMARC policy, so magic links and tickets reach inboxes and the domain can't
# be spoofed. DNS lives in Cloudflare; the `dns_records` output lists what to add.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

data "aws_region" "current" {}

locals {
  mail_from = "bounce.${var.domain}"
}

resource "aws_sesv2_email_identity" "this" {
  email_identity = var.domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "this" {
  email_identity         = aws_sesv2_email_identity.this.email_identity
  mail_from_domain       = local.mail_from
  behavior_on_mx_failure = "REJECT_MESSAGE"
}
