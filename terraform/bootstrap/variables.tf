variable "region" {
  description = "AWS region for the state bucket and lock table."
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Short project name used in resource names."
  type        = string
  default     = "costpilot"
}
