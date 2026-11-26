# Secrets live in AWS Secrets Manager. Terraform creates the empty containers and the access policy.
# You put the real values in with the AWS CLI, so they never appear in Git or in Terraform state.

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  description             = "CostPilot application secrets: JWT_SECRET, MONGO_URI, ANTHROPIC_API_KEY, GITHUB_TOKEN"
  recovery_window_in_days = var.recovery_window_days
}

resource "aws_secretsmanager_secret" "datadog" {
  name                    = "${var.name}/datadog"
  description             = "Datadog keys: api-key and app-key"
  recovery_window_in_days = var.recovery_window_days
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${replace(var.oidc_provider_url, "https://", "")}:sub"
      values   = ["system:serviceaccount:${var.eso_namespace}:${var.eso_service_account}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${replace(var.oidc_provider_url, "https://", "")}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eso" {
  name               = "${var.name}-external-secrets"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Read-only, and only these two secrets. Not "secretsmanager:*" and not every secret in the account.
data "aws_iam_policy_document" "read" {
  statement {
    sid       = "ReadCostPilotSecrets"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [aws_secretsmanager_secret.app.arn, aws_secretsmanager_secret.datadog.arn]
  }
}

resource "aws_iam_role_policy" "read" {
  name   = "read-app-secrets"
  role   = aws_iam_role.eso.id
  policy = data.aws_iam_policy_document.read.json
}
