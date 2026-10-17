terraform {
  required_version = ">= 1.11"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Same state bucket as the environments:
  # terraform init -backend-config=../envs/backend.hcl
  backend "s3" {
    key          = "edge/terraform.tfstate"
    region       = "ap-southeast-2"
    use_lockfile = true
    encrypt      = true
  }
}

# Reads CLOUDFLARE_API_TOKEN from the environment, so the token is never in a
# file or in state. See infra/README.md for the permissions it needs.
provider "cloudflare" {}
