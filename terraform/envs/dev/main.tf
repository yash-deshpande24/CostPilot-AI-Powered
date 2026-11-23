terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name         = "${var.project}-${var.environment}"
  cluster_name = "${var.project}-${var.environment}-eks"
}

module "vpc" {
  source             = "../../modules/vpc"
  name               = local.name
  cluster_name       = local.cluster_name
  cidr               = var.vpc_cidr
  az_count           = var.az_count
  single_nat_gateway = var.single_nat_gateway
}

module "eks" {
  source              = "../../modules/eks"
  name                = local.cluster_name
  kubernetes_version  = var.kubernetes_version
  subnet_ids          = module.vpc.private_subnet_ids
  public_access_cidrs = var.api_allowed_cidrs
  node_instance_types = var.node_instance_types
  node_capacity_type  = var.node_capacity_type
  node_desired        = var.node_desired
  node_min            = var.node_min
  node_max            = var.node_max
  log_retention_days  = var.log_retention_days
}

# Image repositories are shared by every environment, so only one environment creates them.
module "ecr" {
  count        = var.create_ecr ? 1 : 0
  source       = "../../modules/ecr"
  project      = var.project
  force_delete = var.force_destroy
}

module "reports" {
  source        = "../../modules/s3"
  name          = local.name
  force_destroy = var.force_destroy
}

module "sqs" {
  source = "../../modules/sqs"
  name   = local.name
}

module "iam" {
  source             = "../../modules/iam"
  name               = local.name
  namespace          = var.namespace
  oidc_provider_arn  = module.eks.oidc_provider_arn
  oidc_provider_url  = module.eks.oidc_provider_url
  queue_arn          = module.sqs.queue_arn
  reports_bucket_arn = module.reports.bucket_arn
}

module "budget" {
  count             = var.alert_email == "" ? 0 : 1
  source            = "../../modules/budget"
  name              = local.name
  monthly_limit_usd = var.monthly_budget_usd
  alert_email       = var.alert_email
}
