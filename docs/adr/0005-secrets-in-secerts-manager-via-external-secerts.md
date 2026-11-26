# ADR 0005: Secrets in AWS Secrets Manager, copied by External Secrets

Status: accepted

## Context
The app needs a JWT secret, a database URL, and API keys. These must not be in Git, in Terraform state, or in a Kubernetes manifest.

## Decision
- Values live in AWS Secrets Manager. Terraform creates the containers and the read-only policy. The values are typed with the AWS CLI.
- External Secrets Operator copies them into a Kubernetes secret every hour, using an IRSA role limited to those two secrets.

## Consequences
- Rotating a key is one command, and the pods get the new value within an hour, or on restart.
- Terraform state holds no secret values.
- Each secret costs about $0.40 a month.

## Alternatives
- Sealed Secrets: encrypted in Git, but the key must be backed up, and it adds a controller to manage.
- Hand-made Kubernetes secrets: used in Weeks 5 and 6, but they are lost when a cluster is rebuilt.
