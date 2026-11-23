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
