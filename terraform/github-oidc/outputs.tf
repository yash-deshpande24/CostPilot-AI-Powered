output "role_arn" {
  description = "Put this in the GitHub secret AWS_ROLE_ARN."
  value       = aws_iam_role.github_actions.arn
}

output "oidc_provider_arn" {
  description = "The GitHub OIDC provider used by the role."
  value       = local.provider_arn
}
