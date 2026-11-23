variable "project" {
  description = "Project name. Repositories are named project/repository."
  type        = string
}

variable "repositories" {
  description = "Repositories to create."
  type        = list(string)
  default     = ["backend", "frontend", "worker"]
}

variable "immutable_tags" {
  description = "Refuse to overwrite an existing tag. CI must push a unique tag per build, such as the commit hash."
  type        = bool
  default     = true
}

variable "keep_images" {
  description = "Delete images beyond this count, oldest first."
  type        = number
  default     = 20
}

variable "force_delete" {
  description = "Allow terraform destroy to delete repositories that still hold images."
  type        = bool
  default     = false
}
