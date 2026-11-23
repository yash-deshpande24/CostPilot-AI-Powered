output "state_bucket" {
  value = aws_s3_bucket.state.id
}

output "lock_table" {
  value = aws_dynamodb_table.locks.name
}

output "backend_hcl_dev" {
  description = "Copy this into terraform/envs/dev/backend.hcl"
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.state.id}"
    key            = "dev/terraform.tfstate"
    region         = "${var.region}"
    dynamodb_table = "${aws_dynamodb_table.locks.name}"
    encrypt        = true
  EOT
}

output "backend_hcl_prod" {
  description = "Copy this into terraform/envs/prod/backend.hcl"
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.state.id}"
    key            = "prod/terraform.tfstate"
    region         = "${var.region}"
    dynamodb_table = "${aws_dynamodb_table.locks.name}"
    encrypt        = true
  EOT
}
