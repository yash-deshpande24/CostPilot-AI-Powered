# Settings come from backend.hcl, so this file never holds your account details:
#   terraform init -backend-config=backend.hcl
terraform {
  backend "s3" {}
}
