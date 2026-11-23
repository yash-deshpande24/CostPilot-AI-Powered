variable "name" {
  description = "Name prefix, for example costpilot-dev."
  type        = string
}

variable "monthly_limit_usd" {
  description = "Monthly spend limit for the whole AWS account, in US dollars."
  type        = number
}

variable "alert_email" {
  description = "Where to send the 80 percent and forecast alerts."
  type        = string
}
