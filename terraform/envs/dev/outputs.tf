output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "kubeconfig_command" {
  description = "Run this to point kubectl at the cluster."
  value       = module.eks.kubeconfig_command
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecr_repository_urls" {
  value = var.create_ecr ? module.ecr[0].repository_urls : {}
}

output "reports_bucket" {
  value = module.reports.bucket_name
}

output "sqs_queue_url" {
  value = module.sqs.queue_url
}

output "irsa_role_arns" {
  description = "Annotate the Kubernetes service accounts with these in Week 5."
  value       = module.iam.role_arns
}

output "github_ci_role_arn" {
  description = "Set this as the AWS_ROLE_ARN variable in GitHub Actions."
  value       = var.create_ecr ? module.github_oidc[0].role_arn : null
}

output "app_secret_name" {
  description = "Put the app's keys in this secret with: aws secretsmanager put-secret-value"
  value       = module.app_secrets.app_secret_name
}

output "datadog_secret_name" {
  value = module.app_secrets.datadog_secret_name
}

output "eso_role_arn" {
  value = module.app_secrets.eso_role_arn
}
