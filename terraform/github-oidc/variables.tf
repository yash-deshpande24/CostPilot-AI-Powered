variable "region" {
  description = "AWS region that holds the ECR repositories."
  type        = string
  default     = "ap-south-1"
}

variable "github_repo" {
  description = "owner/name of the repository allowed to assume the role."
  type        = string
  default     = "yash-deshpande24/CostPilot-AI-Powered"
}

variable "branch" {
  description = "Only this branch can assume the role."
  type        = string
  default     = "main"
}

variable "ecr_prefix" {
  description = "ECR repositories under this prefix can be pushed to."
  type        = string
  default     = "costpilot"
}

variable "create_oidc_provider" {
  description = "Set to false if the GitHub OIDC provider already exists in this AWS account."
  type        = bool
  default     = true
}
