# Week 5: Helm and ArgoCD put CostPilot on EKS

## How it fits together
```
You push to GitHub  ->  ArgoCD (in the cluster) sees the change  ->  Helm renders costpilot-gitops/charts/costpilot
                                                                       with costpilot-gitops/envs/dev/values.yaml
                                                                  ->  the cluster is changed to match Git
```
Nobody runs `kubectl apply` for the app. Git is the only way changes reach the cluster.

What runs in the `costpilot` namespace: `backend` (the API), `frontend` (the web app), `mongo` (a throwaway dev database) and a `costpilot-scan` CronJob that runs a waste scan every day at 02:00 UTC.

Secrets (JWT secret, database URL, API key) are created with `kubectl` and are never stored in Git. Week 7 replaces this with External Secrets and AWS Secrets Manager.

## Steps
Run from the project root in PowerShell, with the Week 4 cluster up and `kubectl get nodes` showing `Ready`.

1. Check the prefilled values in `costpilot-gitops/envs/dev/values.yaml`:
   ```powershell
   aws sts get-caller-identity --query Account --output text
   terraform -chdir=terraform/envs/dev output irsa_role_arns
   ```
2. Build and push the images, then copy the tag it prints:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\push-images.ps1
   ```
3. Put the tag in `costpilot-gitops/envs/dev/values.yaml` (replace `CHANGE_ME`), then:
   ```powershell
   git add .
   git commit -m "feat: week 5 - helm chart and argocd"
   git push
   ```
4. Install ArgoCD:
   ```powershell
   kubectl create namespace argocd
   kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.3.18/manifests/install.yaml
   kubectl -n argocd rollout status deploy/argocd-server --timeout=300s
   ```
5. Let ArgoCD read your private repository (create a fine-grained GitHub token with read-only Contents access to this one repository):
   ```powershell
   $token = Read-Host "Paste your GitHub token"
   kubectl -n argocd create secret generic repo-costpilot --from-literal=type=git --from-literal=url=https://github.com/yash-deshpande24/CostPilot-AI-Powered.git --from-literal=username=yash-deshpande24 --from-literal=password=$token
   kubectl -n argocd label secret repo-costpilot argocd.argoproj.io/secret-type=repository
   Remove-Variable token
   ```
6. Create the app secret:
   ```powershell
   kubectl create namespace costpilot
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $jwt = [Convert]::ToBase64String($b)
   kubectl -n costpilot create secret generic costpilot-secrets --from-literal=JWT_SECRET=$jwt --from-literal=MONGO_URI=mongodb://mongo:27017/costpilot
   ```
7. Tell ArgoCD about the app (once):
   ```powershell
   kubectl apply -f costpilot-gitops/apps/costpilot-dev.yaml
   kubectl -n argocd get applications
   kubectl -n costpilot get pods
   ```
   Expect `Synced` and `Healthy`, and pods `backend`, `frontend` and `mongo` all `Running`.
8. Open the app:
   ```powershell
   kubectl -n costpilot port-forward svc/frontend 8090:80
   ```
   Browse to http://localhost:8090, create an account and sign in.
9. Run the scan job now:
   ```powershell
   kubectl -n costpilot create job --from=cronjob/costpilot-scan scan-now
   kubectl -n costpilot logs job/scan-now
   ```
   Expect one JSON line with `"event":"scan_job"`.

## See GitOps working
- **Change through Git:** set `frontend.replicas: 2` in `costpilot-gitops/envs/dev/values.yaml`, push, and watch `kubectl -n costpilot get pods`. ArgoCD checks Git about every 3 minutes.
- **Drift healing:** `kubectl -n costpilot scale deploy/frontend --replicas=5`. Within about a minute ArgoCD puts it back, because Git says otherwise.

## ArgoCD web page
```powershell
kubectl -n argocd port-forward svc/argocd-server 8443:443
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
```
Browse to https://localhost:8443 (accept the certificate warning), sign in as `admin`. The password is the long text from the second command, decoded from base64. In PowerShell: `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("PASTE_HERE"))`.

## Use real Claude or real AWS data (optional)
- Claude: recreate the secret with an extra `--from-literal=ANTHROPIC_API_KEY=...`, then `kubectl -n costpilot rollout restart deploy/backend`.
- Real AWS data: set `config.costSource: aws` in `costpilot-gitops/envs/dev/values.yaml` and push. The pods use the read-only IAM roles from Week 4 (no keys). Cost Explorer must be enabled on the account.

## Clean up (important for cost)
1. Remove the app first: `kubectl delete -f costpilot-gitops/apps/costpilot-dev.yaml`
2. If you ever set `frontend.service.type: LoadBalancer`, wait until that load balancer is gone. A leftover one blocks `terraform destroy`.
3. Then `terraform destroy` in `terraform/envs/dev`.

## If something fails
| What you see | Cause and fix |
|---|---|
| `ImagePullBackOff` | Wrong registry or tag, or the image was not pushed. `kubectl -n costpilot describe pod <name>` shows the exact image. |
| `CreateContainerConfigError`, secret not found | Step 6 was skipped. |
| ArgoCD: `required value` error | The tag in values.yaml is still `CHANGE_ME`, or you did not push it to GitHub. |
| ArgoCD: repository not accessible | Step 5: token wrong, expired, or without access to this repository. |
| Pods `Pending` with `Insufficient memory` | One node is full. Set `node_desired = 2` in `terraform/envs/dev/terraform.tfvars` and run `terraform apply`. |
| `backend` in `CrashLoopBackOff` | `kubectl -n costpilot logs deploy/backend`. Usually a wrong `MONGO_URI`. |
| Web page shows errors after sign-in | Backend not ready yet: `kubectl -n costpilot get pods`. |
| Scan job `AccessDenied` | `costSource` is `aws` but the IAM role annotation in values.yaml is wrong. |

## Next: Week 6
GitHub Actions builds and pushes images on every merge, and Jenkins promotes by committing the new tag to `costpilot-gitops/envs/`, which ArgoCD then deploys.
