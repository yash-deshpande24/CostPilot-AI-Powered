variable "name" {
  description = "Name prefix, for example costpilot-dev."
  type        = string
}

variable "retention_days" {
  description = "Delete report files after this many days."
  type        = number
  default     = 365
}

variable "force_destroy" {
  description = "Allow terraform destroy to empty and delete the bucket."
  type        = bool
  default     = false
}
