variable "name" {
  description = "Name prefix for every resource, for example costpilot-dev."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name. Subnets are tagged with it so load balancers find them."
  type        = string
}

variable "cidr" {
  description = "VPC address range."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones (2 or 3)."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "One shared NAT gateway (cheap, for dev) or one per zone (resilient, for prod)."
  type        = bool
  default     = true
}
