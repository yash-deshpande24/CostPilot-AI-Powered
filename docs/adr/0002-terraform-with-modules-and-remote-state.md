# ADR 0002: Terraform modules with remote state and locking

Status: accepted

## Context
Infrastructure must be repeatable, reviewed, and split between dev and prod without copying code.

## Decision
- Reusable modules (vpc, eks, ecr, s3, sqs, iam, budget, app-secrets, github-oidc).
- One state file per environment, in S3 with versioning and encryption.
- Locking through DynamoDB, with S3 native locking as the replacement once the provider supports it.
- A separate `bootstrap` stack creates the state bucket. Its state is local and it is never destroyed in normal use.

## Consequences
- Dev and prod share code but cannot affect each other's state.
- Destroying an environment does not touch the state bucket.
- The CI workflow runs `fmt` and `validate` on every environment.

## Alternatives
- One big root module: simpler at first, but dev changes can break prod.
- Terragrunt: less boilerplate, but one more tool to learn for this project.
