variable "name" {
  description = "Name prefix, for example costpilot-dev."
  type        = string
}

variable "github_repo" {
  description = "The repository allowed to push, written owner/name."
  type        = string
}

variable "branch" {
  description = "The only branch allowed to push images."
  type        = string
  default     = "main"
}

variable "repository_arns" {
  description = "ECR repositories the role may push to."
  type        = list(string)
}

variable "create_provider" {
  description = "Create the GitHub identity provider. Set false if your AWS account already has one."
  type        = bool
  default     = true
}
