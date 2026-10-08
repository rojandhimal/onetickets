terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Bucket name includes the management account id, so it comes from
  # backend.hcl: terraform init -backend-config=../backend.hcl
  backend "s3" {
    key          = "dev/terraform.tfstate"
    region       = "ap-southeast-2"
    use_lockfile = true
    encrypt      = true
  }
}

# Runs with management-account credentials and steps into the dev account.
provider "aws" {
  region = "ap-southeast-2"

  assume_role {
    role_arn = "arn:aws:iam::${var.account_id}:role/OrganizationAccountAccessRole"
  }

  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project     = "onetickets"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
