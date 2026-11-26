# Architecture

## The system in one picture
```mermaid
flowchart TB
  subgraph Users
    eng([Engineer in the browser])
  end
  subgraph AppTier["Application (Kubernetes, namespace costpilot)"]
    fe[frontend - nginx]
    be[backend - API, Argo Rollout]
    scan[CronJob - daily scan]
    smoke[PostSync Job - smoke test]
    mongo[(mongo - dev only)]
  end
  subgraph Platform["Platform (namespaces argocd, argo-rollouts, external-secrets, datadog)"]
    argocd[ArgoCD]
    rollouts[Argo Rollouts controller]
    eso[External Secrets Operator]
    dd[Datadog agent]
  end
  subgraph AWS
    eks[(EKS control plane)]
    ecr[(ECR)]
    sm[(Secrets Manager)]
    ce[(Cost Explorer)]
    ec2[(EC2 / EBS / EIP / CloudWatch)]
    sqs[(SQS)]
    s3[(S3 reports)]
  end
  subgraph External
    gh[(GitHub)]
    claude[(Claude API)]
    ddcloud[(Datadog)]
  end

  eng --> fe --> be
  be --> mongo
  be --> ce
  be --> ec2
  be --> claude
  be -->|Open PR| gh
  scan --> ec2
  scan --> mongo
  argocd -->|watches main| gh
  argocd --> be
  argocd --> fe
  rollouts --> be
  eso --> sm
  eso -->|Kubernetes secret| be
  dd -->|scrapes /metrics| be
  dd --> ddcloud
  be -. image .-> ecr
```

## The delivery path
```mermaid
sequenceDiagram
  autonumber
  participant Dev as Developer
  participant GH as GitHub Actions
  participant ECR
  participant JK as Jenkins
  participant Git as GitHub (gitops values)
  participant Argo as ArgoCD
  participant K8s as EKS

  Dev->>GH: merge to main
  GH->>GH: tests, Terraform and Helm checks, Trivy scan
  GH->>ECR: push image sha-xxxxxxx (role via OIDC, no keys)
  Dev->>JK: run costpilot-promote (IMAGE_TAG)
  JK->>Git: commit new tag to gitops/envs/dev/values.yaml
  Argo->>Git: sees the new commit
  Argo->>K8s: canary 50%, health analysis, then 100%
  Argo->>K8s: PostSync smoke test (API, web page, proxy)
  alt smoke test or analysis fails
    Argo->>K8s: stop and roll back
  end
```

## Where each secret lives
| Secret | Stored in | Read by | Never |
|---|---|---|---|
| App keys (JWT, Mongo URI, Claude, GitHub token) | Secrets Manager `costpilot-<env>/app` | External Secrets, then the API pods | In Git, in Terraform state, in logs |
| Datadog keys | Secrets Manager `costpilot-<env>/datadog` | External Secrets, then the agent | In Git |
| AWS access for pods | IAM roles (IRSA), no keys | API and scan pods | Anywhere |
| AWS access for CI | GitHub OIDC role | GitHub Actions | Anywhere |

## Trust boundaries
- The AI reads a summary of the bill and can only advise. It cannot call AWS.
- Pull requests from the app add a runbook file. Merging changes nothing in AWS.
- Each service account can assume only its own role, and only in its own namespace.
- The web app does not expose `/metrics` or any admin route.

## Environments
| | dev | prod |
|---|---|---|
| Nodes | 1 to 2 (on-demand m7i-flex.large) | 3 to 6 across 3 zones |
| NAT | one shared | one per zone |
| Database | in-cluster throwaway | MongoDB Atlas (planned) |
| Cost source | sample data (switch to aws when ready) | AWS Cost Explorer |
| Secret store | Secrets Manager | Secrets Manager |
| Prod cluster | not needed for the learning path | described, not applied |
