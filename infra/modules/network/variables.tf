variable "name" {
  type = string
}

variable "cidr_block" {
  type = string
}

variable "single_nat_gateway" {
  description = "Share one NAT gateway across both AZs. Cheaper, but an AZ outage cuts private subnets in the other AZ off from the internet."
  type        = bool
  default     = true
}
