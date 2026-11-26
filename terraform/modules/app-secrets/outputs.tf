output "app_secret_name" {
  value = aws_secretsmanager_secret.app.name
}

output "datadog_secret_name" {
  value = aws_secretsmanager_secret.datadog.name
}

output "eso_role_arn" {
  description = "Annotate the external-secrets service account with this role (gitops/platform)."
  value       = aws_iam_role.eso.arn
}
