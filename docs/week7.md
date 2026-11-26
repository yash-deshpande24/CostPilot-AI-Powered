# Week 7: Datadog, secrets from AWS, and canary releases

## What you get
| Piece | What it does | Where |
|---|---|---|
| Metrics page | The API counts requests, latency, Claude calls and tokens at `/metrics` | `backend/src/services/metrics.js` |
| Datadog agent | Reads that page, the logs and the cluster state. Dashboard and 3 alerts | `gitops/platform/datadog/` |
| AWS Secrets Manager | Holds the app's keys and the Datadog keys. Nothing secret lives in Git | `terraform/modules/app-secrets/` |
| External Secrets | Copies those keys into the cluster every hour, with a read-only role | `gitops/platform/config/`, `gitops/charts/costpilot/templates/external-secret.yaml` |
| Argo Rollouts | The API goes out as a canary: 50% of pods first, a health check, then the rest. A failed check rolls back | `gitops/charts/costpilot/templates/backend.yaml`, `analysis.yaml` |

## Before you start
- Week 6 works: `kubectl get nodes` shows `Ready`, ArgoCD shows the dev app `Synced` and `Healthy`. If Terraform still says the state bucket is missing, fix that first (see the Week 6 notes).
- **Use 2 nodes for Week 7.** Datadog and the canary need room. In `terraform/envs/dev/terraform.tfvars` add the line `node_desired = 2` with `Add-Content`, not by overwriting the file, and run `terraform apply`.
- Datadog: create a free trial at datadoghq.com. In **Organization Settings, API Keys** make an API key. In **Application Keys** make an application key.

## Step 1: Terraform creates the secrets and the role (about 3 minutes)
```powershell
cd terraform\envs\dev
terraform init "-backend-config=backend.hcl"
terraform plan -out tfplan
```
The plan should add a few things (two secrets, a role and a policy) and destroy nothing. If it wants to destroy anything, type `no` and paste the plan.
```powershell
terraform apply tfplan
terraform output eso_role_arn
terraform output app_secret_name
terraform output datadog_secret_name
cd ..\..
```
The role ARN should be `arn:aws:iam::208805233492:role/costpilot-dev-external-secrets`. It's already in the platform file. If yours differs, change it in `gitops/platform/apps/external-secrets.yaml`.

## Step 2: Put the keys in Secrets Manager (never in Git)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\put-secrets.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\put-datadog-keys.ps1
```
Type the values when asked. Press Enter to generate the JWT secret. Values are not shown or saved. Check that the keys arrived, without printing values:
```powershell
aws secretsmanager describe-secret --secret-id costpilot-dev/app --region ap-south-1 --query "Name"
```

## Step 3: Install the platform, in this order
Each command needs the previous step to be healthy first.
```powershell
kubectl apply -f gitops/platform/apps/external-secrets.yaml
kubectl -n argocd get application external-secrets
```
Wait until it says `Synced` and `Healthy` (1 to 2 minutes), then:
```powershell
kubectl apply -f gitops/platform/apps/argo-rollouts.yaml
kubectl -n argo-rollouts get pods
kubectl apply -f gitops/platform/apps/platform-config.yaml
kubectl get clustersecretstore aws-secrets-manager
kubectl apply -f gitops/platform/apps/datadog.yaml
```
Check the secret store says `Valid` (the STATUS column). If it says `InvalidProviderConfig` or `AccessDenied`, the role ARN in step 1 does not match, or the policy was not applied.

## Step 4: Switch the app to AWS secrets
The Argo Rollouts CRD must exist before the app syncs again, which step 3 ensured.

Delete the hand-made secret, so External Secrets can take it over:
```powershell
kubectl -n costpilot delete secret costpilot-secrets
```
In `gitops/envs/dev/values.yaml` change `fromAws: false` to `fromAws: true`. Then:
```powershell
git add .
git status
git commit -m "feat: week 7 - secrets from aws, canary rollouts, datadog"
git push
```
`git status` must not list `.env`, `terraform.tfvars`, `backend.hcl` or any secret file.

Use Jenkins from Week 6 to promote the newest image tag to dev. Then:
```powershell
kubectl -n costpilot get externalsecret costpilot-secrets
kubectl -n costpilot get secret costpilot-secrets
kubectl -n costpilot get rollout backend
```
The ExternalSecret should say `SecretSynced`, the secret should exist, and the rollout should show the new version.

## Step 5: Watch a canary release
Promote a new tag in Jenkins and watch:
```powershell
kubectl -n costpilot get rollout backend -w
kubectl -n costpilot get analysisrun
```
The rollout moves through its steps: half of the pods get the new version, the health analysis runs three checks, then the rest switch over. `kubectl -n costpilot describe rollout backend` shows each step.

To prove the canary check works, put the app's health check on the canary service only:
```powershell
kubectl -n costpilot port-forward svc/backend-canary 5001:5000
```
Then in another window: `Invoke-RestMethod http://localhost:5001/health`. It should say `ok`.

## Step 6: Prove a bad release rolls back (optional, the most useful test)
1. On a new branch, change `/health` in `backend/src/index.js` so it returns `{ status: 'down' }`. Merge it to main, let CI build the image, and promote its tag in Jenkins.
2. Watch `kubectl -n costpilot get analysisrun`. The analysis fails and the rollout is aborted. The old version keeps serving users (`kubectl -n costpilot get pods` shows the old pods still `Running`).
3. Revert the change, promote the good tag again.

Users were never sent the bad version beyond the canary share, and the analysis stopped the release automatically.

## Step 7: Datadog dashboards and alerts
Give the setup script your keys for this one session, then run it:
```powershell
$env:DD_API_KEY = Read-Host "Datadog API key"
$env:DD_APP_KEY = Read-Host "Datadog application key"
powershell -ExecutionPolicy Bypass -File .\scripts\datadog-setup.ps1 -Site datadoghq.com
Remove-Item Env:DD_API_KEY, Env:DD_APP_KEY
```
If your Datadog account is in Europe, use `-Site datadoghq.eu`. The script prints the dashboard link.

Generate some traffic so there's data to look at:
```powershell
kubectl -n costpilot port-forward svc/frontend 8090:80
```
In another window, sign in at http://localhost:8090 and click around, or run a loop: `1..50 | ForEach-Object { Invoke-RestMethod http://localhost:8090/api/health | Out-Null }`.

Wait 5 minutes, then in Datadog open **Metrics, Explorer** and search `costpilot_http_requests_total`. If it shows up, the dashboard works. If it doesn't, the agent cannot read the page yet: check `kubectl -n datadog get pods` and `kubectl -n datadog exec ds/datadog-agent -c agent -- agent status`, and look for the openmetrics check. Metric names can gain or lose a prefix depending on the agent version. If that happens, edit the metric names in `gitops/platform/datadog/dashboards/costpilot-overview.json` and rerun the script, after deleting the old dashboard in the Datadog UI.

Logs: the daily scan job prints one JSON line with `"event":"scan_job"`. In Datadog Logs, search `event:scan_job` to see the findings over time.

## When the error alert fires
1. Check the newest analysis: `kubectl -n costpilot get analysisrun`.
2. Check the logs: `kubectl -n costpilot logs deploy/...` (for a rollout, use `kubectl -n costpilot logs -l app.kubernetes.io/name=backend --tail 50`).
3. If the release is bad, roll back by promoting the previous good tag in Jenkins.

## Cost (roughly, check the pricing pages)
- AWS Secrets Manager: about $0.40 per secret per month, two secrets, so about $0.80 a month. Dev uses a zero-day deletion window so destroy is immediate.
- Datadog: free trial first, then per host. The agent on every node counts as a host, and APM and logs add more.
- Two nodes cost roughly double the single node from Week 4.

## Clean up
```powershell
kubectl delete -f gitops/platform/apps/datadog.yaml
kubectl delete -f gitops/platform/apps/platform-config.yaml
kubectl delete -f gitops/platform/apps/argo-rollouts.yaml
kubectl delete -f gitops/platform/apps/external-secrets.yaml
kubectl delete -f gitops/apps/costpilot-dev.yaml
cd terraform\envs\dev
terraform destroy
```
Delete the Datadog dashboard and monitors in the Datadog UI if you don't want them kept.

## If something fails
| What you see | Cause and fix |
|---|---|
| ExternalSecret `SecretSyncedError`, AccessDenied | The IAM role is missing the policy, or the secret name differs. Run `terraform output app_secret_name` and compare with `secrets.awsSecretKey` in values. |
| ClusterSecretStore `InvalidProviderConfig` | The external-secrets service account has no role annotation. Check the ARN in `external-secrets.yaml` and that ArgoCD has synced it. |
| Secret created but the app says JWT or Mongo missing | You skipped a key in step 2. Run `put-secrets.ps1` again. |
| Costpilot app `OutOfSync` with "no matches for kind Rollout" | Step 3 was skipped. Install argo-rollouts first. |
| Rollout stuck at a step | `kubectl -n costpilot describe rollout backend`. Often the canary pod is not ready: `kubectl -n costpilot get pods`. |
| Datadog pods `Pending` | Not enough memory on the nodes. Use 2 nodes (see before you start). |
| Datadog shows no `costpilot_*` metrics | Give it 5 minutes and generate traffic. Check the openmetrics check in `agent status`. |
| `helm search repo` shows a newer version | Update `targetRevision` in the platform apps after you test it. The versions in these files were not verified against the live repos. |

## Note on versions
The chart versions in `gitops/platform/apps/` (external-secrets 0.19.2, argo-rollouts 2.40.5, datadog 3.160.2) were pinned without checking the live Helm repositories. Before applying, run:
```powershell
helm repo add external-secrets https://charts.external-secrets.io
helm repo add argo https://argoproj.github.io/argo-helm
helm repo add datadog https://helm.datadoghq.com
helm repo update
helm search repo external-secrets/external-secrets --versions | Select-Object -First 3
helm search repo argo/argo-rollouts --versions | Select-Object -First 3
helm search repo datadog/datadog --versions | Select-Object -First 3
```
Use the newest stable version (no `-rc` or `-beta`) in each file if it differs.

## Next: Week 8
Polish: the architecture diagram, the README, a demo video, and an ADR for each big decision.
