provider "aws" {
  region = var.aws_region
  default_tags { tags = { Project = "CostPilot", Environment = "dev", ManagedBy = "Terraform" } }
}
