# Plans the module with fake credentials and checks the key policies Terraform
# would write. No AWS calls: the policy documents are rendered locally.
# Run with `terraform init -backend=false && terraform test` in this folder.

provider "aws" {
  region                      = "ap-southeast-2"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
}

override_data {
  target = data.aws_caller_identity.current
  values = { account_id = "111111111111" }
}

override_resource {
  target          = aws_iam_role.signer
  override_during = plan
  values = {
    arn = "arn:aws:iam::111111111111:role/x-ticket-signer"
    id  = "x-ticket-signer"
  }
}

run "only_the_active_generation_signs" {
  command = plan

  variables {
    name        = "x"
    generations = ["2026-10", "2027-10"]
  }

  assert {
    condition     = aws_kms_alias.active.name == "alias/x-ticket-signing"
    error_message = "The signing worker's alias should be alias/<name>-ticket-signing."
  }
  assert {
    condition     = length([for s in data.aws_iam_policy_document.key["2027-10"].statement : s if s.sid == "SignerSign"]) == 1
    error_message = "The newest generation should let the signer sign."
  }
  assert {
    condition     = length([for s in data.aws_iam_policy_document.key["2026-10"].statement : s if contains(s.actions, "kms:Sign")]) == 0
    error_message = "An older generation should not let anyone sign."
  }
  assert {
    condition = alltrue(flatten([
      for doc in data.aws_iam_policy_document.key : [
        for s in doc.statement : !contains(s.actions, "kms:Sign") if s.sid == "AccountAdmin"
      ]
    ]))
    error_message = "The account root must not get kms:Sign, or IAM policies could grant it to the api."
  }
  assert {
    condition     = [for s in data.aws_iam_policy_document.signer.statement : s.actions] == [toset(["kms:Sign"]), toset(["kms:GetPublicKey"])]
    error_message = "The signer's IAM policy should allow only kms:Sign and kms:GetPublicKey."
  }
}

run "generations_are_unique_slugs" {
  command = plan

  variables {
    name        = "x"
    generations = ["A", "A"]
  }

  expect_failures = [var.generations]
}
