output "role_arns" {
  description = "Put these in the Helm chart's service account annotations (Week 5)."
  value       = { for k, r in aws_iam_role.irsa : k => r.arn }
}
