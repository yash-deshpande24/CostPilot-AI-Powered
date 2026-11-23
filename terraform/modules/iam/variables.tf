variable "name" {
  description = "Name prefix, for example costpilot-dev."
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the cluster's OIDC provider (from the eks module)."
  type        = string
}

variable "oidc_provider_url" {
  description = "Issuer URL of the cluster's OIDC provider (from the eks module)."
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace the app runs in."
  type        = string
  default     = "costpilot"
}

variable "backend_service_account" {
  description = "Kubernetes service account used by the API pods."
  type        = string
  default     = "costpilot-backend"
}

variable "worker_service_account" {
  description = "Kubernetes service account used by the worker pods."
  type        = string
  default     = "costpilot-worker"
}

variable "queue_arn" {
  description = "ARN of the scan-jobs queue."
  type        = string
}

variable "reports_bucket_arn" {
  description = "ARN of the reports bucket."
  type        = string
}
