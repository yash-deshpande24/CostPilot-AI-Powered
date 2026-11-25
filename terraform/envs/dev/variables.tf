variable "region" {
  description = "AWS region."
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Short project name used in resource names."
  type        = string
  default     = "costpilot"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "namespace" {
  description = "Kubernetes namespace the app runs in."
  type        = string
  default     = "costpilot"
}

variable "vpc_cidr" {
  description = "VPC address range."
  type        = string
  default     = "10.10.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "true = one shared NAT gateway (cheaper). false = one per zone."
  type        = bool
  default     = true
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version."
  type        = string
  default     = "1.35"
}

variable "api_allowed_cidrs" {
  description = "Who may reach the Kubernetes API from the internet. Use your own IP, for example [\"203.0.113.7/32\"]."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "Node instance types."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium"]
}

variable "node_capacity_type" {
  description = "ON_DEMAND or SPOT. SPOT is cheaper but can be interrupted."
  type        = string
  default     = "SPOT"
}

variable "node_desired" {
  description = "Starting number of nodes."
  type        = number
  default     = 2
}

variable "node_min" {
  description = "Smallest number of nodes."
  type        = number
  default     = 1
}

variable "node_max" {
  description = "Largest number of nodes."
  type        = number
  default     = 3
}

variable "log_retention_days" {
  description = "Days to keep control plane logs."
  type        = number
  default     = 14
}

variable "create_ecr" {
  description = "Create the image repositories in this environment. Only one environment should."
  type        = bool
  default     = true
}

variable "force_destroy" {
  description = "Let terraform destroy delete buckets and repositories that still hold data."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email for budget alerts. Leave empty to skip creating a budget."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly limit for the whole AWS account, in US dollars."
  type        = number
  default     = 150
}

variable "github_repo" {
  description = "The GitHub repository allowed to push images, written owner/name."
  type        = string
  default     = "yash-deshpande24/CostPilot-AI-Powered"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub identity provider in AWS. Set false if your account already has one (the error says EntityAlreadyExists)."
  type        = bool
  default     = true
}
