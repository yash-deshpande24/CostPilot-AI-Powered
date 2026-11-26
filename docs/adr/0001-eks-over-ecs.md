# ADR 0001: Use EKS (Kubernetes) instead of ECS

Status: accepted

## Context
The platform runs an API, a scan job, a web app, a canary release controller and an observability agent. Some of these need cluster-level features: per-pod IAM roles, custom controllers, GitOps tooling and Kubernetes-native jobs.

## Decision
Run everything on Amazon EKS.

## Consequences
- The EKS control plane costs about $73 a month, plus the nodes. That is more than ECS Fargate for a small app.
- We get ArgoCD, Argo Rollouts, External Secrets and the Datadog operator, all designed for Kubernetes.
- Per-pod IAM roles (IRSA) map cleanly to least privilege.
- The learning value is high, and it matches what most platform teams run.

## Alternatives
- **ECS on Fargate:** cheaper and simpler, but no GitOps or canary tooling that fits as well.
- **Lambda:** good for the scan job, but not for the always-on API.
