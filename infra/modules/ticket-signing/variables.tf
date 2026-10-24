variable "name" {
  description = "Environment name prefix, e.g. onetickets-staging."
  type        = string
}

variable "generations" {
  description = "Signing key generations, oldest first. The last one signs; the others stay for verifying tickets already issued. Add one to rotate."
  type        = list(string)

  validation {
    condition     = length(var.generations) > 0 && length(var.generations) == length(distinct(var.generations))
    error_message = "List at least one generation, each once."
  }
  validation {
    condition     = alltrue([for g in var.generations : can(regex("^[a-z0-9-]+$", g))])
    error_message = "Generations are lower-case letters, digits and hyphens, e.g. 2026-10."
  }
}
