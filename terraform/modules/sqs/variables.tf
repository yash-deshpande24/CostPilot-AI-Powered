variable "name" {
  description = "Name prefix, for example costpilot-dev."
  type        = string
}

variable "visibility_timeout" {
  description = "Seconds a job stays hidden while a worker handles it. Set above your longest scan."
  type        = number
  default     = 300
}

variable "max_receive_count" {
  description = "Failed attempts before a job moves to the dead-letter queue."
  type        = number
  default     = 5
}
