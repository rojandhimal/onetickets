output "identity_arn" {
  value = aws_sesv2_email_identity.this.arn
}

output "dns_records" {
  description = "Records to add in Cloudflare (DNS only, not proxied)."
  value = concat(
    [for t in aws_sesv2_email_identity.this.dkim_signing_attributes[0].tokens : {
      type  = "CNAME"
      name  = "${t}._domainkey.${var.domain}"
      value = "${t}.dkim.amazonses.com"
    }],
    [
      {
        type  = "MX"
        name  = local.mail_from
        value = "10 feedback-smtp.${data.aws_region.current.region}.amazonses.com"
      },
      {
        type  = "TXT"
        name  = local.mail_from
        value = "v=spf1 include:amazonses.com -all"
      },
      {
        type  = "TXT"
        name  = "_dmarc.${var.domain}"
        value = "v=DMARC1; p=quarantine; adkim=s; aspf=r${var.dmarc_report_email == "" ? "" : "; rua=mailto:${var.dmarc_report_email}"}"
      },
    ],
  )
}
