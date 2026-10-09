variable "name" {
  type = string
}

variable "cidr_block" {
  type = string
}

variable "nat_gateways" {
  description = "0 (app tasks go in public subnets with public IPs; cheapest), 1 (shared; an AZ outage cuts the other AZ off), or 2 (one per AZ)."
  type        = number
  default     = 1

  validation {
    condition     = contains([0, 1, 2], var.nat_gateways)
    error_message = "nat_gateways must be 0, 1 or 2."
  }
}
