# Week 4: Terraform builds the AWS infrastructure

## What gets created
| Piece | What it is |
|---|---|
| `bootstrap/` | S3 bucket and DynamoDB table that hold Terraform's state and lock it. Run once. |
| `modules/vpc` | VPC, public and private subnets in 2 or 3 zones, internet gateway, NAT gateway, free S3 endpoint |
| `modules/eks` | EKS cluster (secrets encrypted with KMS), managed node group, OIDC provider for IRSA, core add-ons |
| `modules/ecr` | Image repositories `costpilot/backend`, `/frontend`, `/worker` with scan on push and a keep-20 policy |
| `modules/s3` | Encrypted, private reports bucket |
| `modules/sqs` | Scan job queue and a dead-letter queue |
| `modules/iam` | IAM roles for the backend and worker pods (IRSA) with read-only AWS access |
| `modules/budget` | Optional AWS budget that emails you at 80% |
| `envs/dev`, `envs/prod` | Each environment is a separate state file that calls the modules |

## Cost: read before you apply
A running EKS cluster is not free. Rough guide, check the AWS pricing page for your region:
- EKS control plane: about $0.10 per hour (about $73 a month) while it exists
- NAT gateway: about $0.045 per hour plus data (about $33 a month), and prod uses one per zone
- Worker nodes: dev uses 2 Spot t3 nodes (cheap); prod uses 3 on-demand m5.large (several times more)

**Dev can cost roughly $5 to $8 a day while it is up. Run `terraform destroy` when you stop for the day.**
Set `alert_email` so AWS warns you early. Do not create prod just to practise.

Kubernetes 1.35 is the default because versions past standard support cost more per hour. 1.34 loses standard support on 2 December 2026. The cluster uses `support_type = "STANDARD"` so AWS upgrades it rather than billing extended support.

## Setup (Windows)
1. Install Terraform and the AWS CLI. Run `aws configure` with an IAM user that can create these resources (an admin user is simplest while learning).
2. Check the code without touching AWS:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\tf-validate.ps1
   ```
3. Create the state bucket (once):
   ```powershell
   cd terraform\bootstrap
   terraform init
   terraform apply
   terraform output
   cd ..\..
   ```
4. Create `terraform\envs\dev\backend.hcl` from `backend.hcl.example`, using the printed `backend_hcl_dev` values.
5. Keep your account details out of Git:
   ```powershell
   Add-Content .gitignore "terraform/**/backend.hcl"
   ```
6. Build dev:
   ```powershell
   cd terraform\envs\dev
   Copy-Item terraform.tfvars.example terraform.tfvars   # then edit it
   terraform init -backend-config=backend.hcl
   terraform plan -out tfplan
   terraform apply tfplan
   ```
   Creating the cluster takes about 15 minutes.
7. Connect kubectl and check:
   ```powershell
   terraform output -raw kubeconfig_command | Invoke-Expression
   kubectl get nodes
   ```
   You should see your nodes with status `Ready`.
8. When you finish for the day:
   ```powershell
   terraform destroy
   ```

Commit `.terraform.lock.hcl` files. Never commit `*.tfstate`, `terraform.tfvars` or `backend.hcl`.

## Safety built in
- State is encrypted, versioned and private, and locked in DynamoDB so two applies cannot collide.
- Buckets block public access and refuse non-TLS requests.
- Kubernetes secrets are encrypted with a KMS key that rotates.
- Pods get IAM roles through IRSA. Each role can be assumed only by one named service account in the `costpilot` namespace.
- The default security group has no rules.
- Restrict `api_allowed_cidrs` to your own IP so the Kubernetes API is not open to the whole internet.

## If something fails
- **`terraform validate` reports an unknown argument:** the AWS provider changes over time. Paste the exact message and the file name.
- **`AccessDenied` on apply:** your IAM user lacks a permission. The message names the action.
- **`BucketAlreadyExists`:** bucket names are global. Change `project` in the variables.
- **Cluster stuck creating:** check that the NAT gateway exists, because nodes need it to reach AWS.
- **Cluster version rejected:** that version is no longer offered. Pick one from the EKS version calendar.
- **`terraform destroy` stops on a non-empty bucket in prod:** that is deliberate (`force_destroy = false`). Empty it yourself first.

## Next: Week 5
Helm chart and ArgoCD, deployed onto this cluster, using the `irsa_role_arns` and `sqs_queue_url` outputs.
