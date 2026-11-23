locals {
  oidc = replace(var.oidc_provider_url, "https://", "")
  service_accounts = {
    backend = var.backend_service_account
    worker  = var.worker_service_account
  }
}

# Same read-only permissions as docs/iam-policy.json.
data "aws_iam_policy_document" "aws_readonly" {
  statement {
    sid       = "CostExplorer"
    actions   = ["ce:GetCostAndUsage"]
    resources = ["*"]
  }
  statement {
    sid       = "DescribeResources"
    actions   = ["ec2:DescribeVolumes", "ec2:DescribeAddresses", "ec2:DescribeInstances"]
    resources = ["*"]
  }
  statement {
    sid       = "Metrics"
    actions   = ["cloudwatch:GetMetricStatistics"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "aws_readonly" {
  name   = "${var.name}-aws-readonly"
  policy = data.aws_iam_policy_document.aws_readonly.json
}

# Only the named Kubernetes service account in the named namespace may assume each role.
data "aws_iam_policy_document" "assume" {
  for_each = local.service_accounts
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${each.value}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "irsa" {
  for_each           = local.service_accounts
  name               = "${var.name}-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.assume[each.key].json
}

resource "aws_iam_role_policy_attachment" "aws_readonly" {
  for_each   = aws_iam_role.irsa
  role       = each.value.name
  policy_arn = aws_iam_policy.aws_readonly.arn
}

# The API sends scan jobs and reads reports.
data "aws_iam_policy_document" "backend" {
  statement {
    sid       = "SendJobs"
    actions   = ["sqs:SendMessage", "sqs:GetQueueUrl", "sqs:GetQueueAttributes"]
    resources = [var.queue_arn]
  }
  statement {
    sid       = "ReadReports"
    actions   = ["s3:GetObject"]
    resources = ["${var.reports_bucket_arn}/*"]
  }
  statement {
    sid       = "ListReports"
    actions   = ["s3:ListBucket"]
    resources = [var.reports_bucket_arn]
  }
}

# The worker takes jobs off the queue and writes reports.
data "aws_iam_policy_document" "worker" {
  statement {
    sid       = "ConsumeJobs"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueUrl", "sqs:GetQueueAttributes"]
    resources = [var.queue_arn]
  }
  statement {
    sid       = "WriteReports"
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${var.reports_bucket_arn}/*"]
  }
  statement {
    sid       = "ListReports"
    actions   = ["s3:ListBucket"]
    resources = [var.reports_bucket_arn]
  }
}

resource "aws_iam_role_policy" "backend" {
  name   = "queue-and-reports"
  role   = aws_iam_role.irsa["backend"].id
  policy = data.aws_iam_policy_document.backend.json
}

resource "aws_iam_role_policy" "worker" {
  name   = "queue-and-reports"
  role   = aws_iam_role.irsa["worker"].id
  policy = data.aws_iam_policy_document.worker.json
}
