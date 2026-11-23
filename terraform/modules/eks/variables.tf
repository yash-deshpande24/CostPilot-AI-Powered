variable "name" {
  description = "Cluster name, for example costpilot-dev-eks."
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version. Check the EKS version calendar: a version past standard support costs more."
  type        = string
  default     = "1.35"
}

variable "support_type" {
  description = "STANDARD upgrades the cluster at the end of standard support. EXTENDED keeps the old version at a higher price."
  type        = string
  default     = "STANDARD"
}

variable "subnet_ids" {
  description = "Private subnets for the cluster and nodes."
  type        = list(string)
}

variable "endpoint_public_access" {
  description = "Allow kubectl from the internet (limited by public_access_cidrs)."
  type        = bool
  default     = true
}

variable "public_access_cidrs" {
  description = "Who may reach the public API endpoint. Use your own IP, for example [\"203.0.113.7/32\"]."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "Instance types for the node group. Give two or more when using SPOT."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_capacity_type" {
  description = "ON_DEMAND or SPOT."
  type        = string
  default     = "ON_DEMAND"
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

variable "node_disk_size" {
  description = "Node disk size in GB."
  type        = number
  default     = 30
}

variable "log_types" {
  description = "Control plane logs to send to CloudWatch. Each type adds log storage cost."
  type        = list(string)
  default     = ["api", "audit", "authenticator"]
}

variable "log_retention_days" {
  description = "Days to keep control plane logs."
  type        = number
  default     = 14
}
