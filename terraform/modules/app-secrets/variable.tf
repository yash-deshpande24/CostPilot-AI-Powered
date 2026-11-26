variable "name" {
  description = "Name prefix, for example costpilot-dev. Secrets are named <name>/app and <name>/datadog."
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the EKS cluster's OIDC provider."
  type        = string
}

variable "oidc_provider_url" {
  description = "Issuer URL of the EKS cluster's OIDC provider."
  type        = string
}

variable "eso_namespace" {
  description = "Namespace where External Secrets Operator runs."
  type        = string
  default     = "external-secrets"
}

variable "eso_service_account" {
  description = "Service account used by External Secrets Operator."
  type        = string
  default     = "external-secrets"
}

variable "recovery_window_days" {
  description = "Days a deleted secret can still be restored. Use 0 for dev so destroy is immediate."
  type        = number
  default     = 7
}
