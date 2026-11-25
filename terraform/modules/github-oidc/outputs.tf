output "role_arn" {
  description = "Put this in GitHub: Settings, Secrets and variables, Actions, Variables, AWS_ROLE_ARN."
  value       = aws_iam_role.ci.arn
}
