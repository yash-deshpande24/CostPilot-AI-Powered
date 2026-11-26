# ADR 0004: GitHub Actions builds, Jenkins promotes, ArgoCD deploys

Status: accepted

## Context
Building an image and deciding that it should reach dev or prod are different decisions. They should have different owners and different checks.

## Decision
- **GitHub Actions** runs tests, Terraform and Helm checks, builds images, scans them, and pushes to ECR. It never touches the cluster.
- **Jenkins** promotes one tag to one environment. Prod needs a human approval.
- **ArgoCD** deploys whatever tag Git contains.

## Consequences
- A pushed image is not automatically deployed. Promotion is a separate, recorded action.
- The Jenkins job writes only one line in one file, which keeps the audit trail small.
- Prod can wait for approval without slowing down CI.

## Alternatives
- Deploy from CI straight to the cluster: fewer steps, but no approval point and the cluster credentials would live in CI.
