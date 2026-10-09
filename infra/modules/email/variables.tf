variable "domain" {
  description = "Domain mail is sent from, e.g. onetickets.com.au or staging.onetickets.com.au."
  type        = string
}

variable "dmarc_report_email" {
  description = "Mailbox for aggregate DMARC reports. Empty means no reports."
  type        = string
  default     = ""
}
