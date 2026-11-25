# Week 6: GitHub Actions, Jenkins and pull requests

## How a change travels
```
You merge to main
   -> GitHub Actions: tests, Terraform and Helm checks, build, security scan, push images to ECR (tag sha-1a2b3c4)
   -> You run the Jenkins job: it writes that tag into gitops/envs/dev/values.yaml and pushes to Git
   -> ArgoCD sees the commit and deploys it
   -> ArgoCD runs a smoke test inside the cluster. If it fails, the sync shows as failed.
```
GitHub Actions never touches the cluster. Jenkins never builds anything. Each does one job.

Production: `gitops/envs/prod/values.yaml` and `gitops/apps/costpilot-prod.yaml` are ready, and Jenkins asks for approval before writing to prod. Nothing deploys until a prod cluster exists, so treat it as a rehearsal. Do not apply costpilot-prod.yaml to your dev cluster.

## Before you start
- The Week 4 cluster is running (`kubectl get nodes` shows `Ready`) and the Week 5 app is `Synced` and `Healthy` in ArgoCD.
- Docker Desktop is running.

## Part 1: Let GitHub push images (Terraform, about 5 minutes)
```powershell
cd terraform\envs\dev
terraform init "-backend-config=backend.hcl"
terraform plan -out tfplan
```
The plan should say `3 to add` (a GitHub identity provider, a role and a policy) and nothing to change or destroy. Then:
```powershell
terraform apply tfplan
terraform output -raw github_ci_role_arn
```
Copy the role ARN it prints. If apply says `EntityAlreadyExists` for the provider, your AWS account already has a GitHub provider. Add `create_github_oidc_provider = false` to `terraform.tfvars` with Add-Content (never overwrite the file), then run plan and apply again.

## Part 2: Tell GitHub the role (2 minutes)
On github.com open the repository, then Settings, Secrets and variables, Actions, the **Variables** tab, New repository variable. Name `AWS_ROLE_ARN`, value the ARN from Part 1. No keys or secrets are stored anywhere.

## Part 3: Push and watch the checks run
From the project root:
```powershell
git add .
git status
git commit -m "feat: week 6 - ci, jenkins promotion and fix pull requests"
git push
```
`.env`, `terraform.tfvars` and `backend.hcl` must not appear in `git status`.

Open the repository's Actions tab and click the newest CI run. You should see 5 checks go green (Backend tests, Frontend build, Terraform checks, Helm chart checks, Build and scan x2), then **Push images to ECR**. Open that last job's summary: it shows the tag, for example `sha-1a2b3c4`. Copy it.

Check the images arrived:
```powershell
aws ecr list-images --repository-name costpilot/backend --region ap-south-1 --query "imageIds[].imageTag" --output text
```

## Part 4: Start Jenkins (10 minutes)
```powershell
docker compose -f jenkins/docker-compose.yml up -d --build
docker compose -f jenkins/docker-compose.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Open http://localhost:8085, paste that password, choose "Install suggested plugins", and create your admin user.

Create a GitHub token for Jenkins: GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens. Only this repository, permission **Contents: Read and write**. In Jenkins: Manage Jenkins, Credentials, System, Global credentials, Add Credentials. Kind: Username with password. Username: `yash-deshpande24`. Password: the token. **ID: `github-token`** (exactly).

Create the job: New Item, name `costpilot-promote`, type Pipeline. Under Pipeline choose "Pipeline script from SCM", SCM Git, repository `https://github.com/yash-deshpande24/CostPilot-AI-Powered.git`, credentials `github-token`, branch `*/main`, script path `Jenkinsfile`. Save.

Click **Build Now** once. It will fail at "Check input", which is expected: this first run only teaches Jenkins the parameters.

## Part 5: Promote and watch ArgoCD deploy
Click **Build with Parameters**: ENVIRONMENT `dev`, IMAGE_TAG the tag from Part 3. Build. The log should end with `Finished: SUCCESS` and show the new `tag:` line.

Then:
```powershell
kubectl -n argocd get applications
kubectl -n costpilot get pods
```
Within about 3 minutes ArgoCD syncs and the pods restart on the new tag. To see the smoke test result:
```powershell
kubectl -n argocd get application costpilot-dev -o jsonpath="{.status.operationState.phase}"
```
`Succeeded` means the deploy and the smoke test both passed. Prove the new version is live:
```powershell
kubectl -n costpilot port-forward svc/frontend 8090:80
```
In a second window: `Invoke-RestMethod http://localhost:8090/api/health`. The `version` must equal your tag.

**See the safety net:** run Jenkins again with IMAGE_TAG `sha-0000000` (a tag that does not exist). The new pods go to `ImagePullBackOff`, but the old pods keep serving and the app stays up. Promote the correct tag again to fix it.

## Part 6: Pull requests for waste findings
Create a second fine-grained GitHub token for the app, named `costpilot-app`: this repository only, **Contents: Read and write** and **Pull requests: Read and write**. Add it to the cluster secret, keeping the other keys:
```powershell
$jwt = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String((kubectl -n costpilot get secret costpilot-secrets -o jsonpath="{.data.JWT_SECRET}")))
$gh = Read-Host "Paste the costpilot-app token"
kubectl -n costpilot create secret generic costpilot-secrets --from-literal=JWT_SECRET=$jwt --from-literal=MONGO_URI=mongodb://mongo:27017/costpilot --from-literal=GITHUB_TOKEN=$gh --dry-run=client -o yaml | kubectl apply -f -
kubectl -n costpilot rollout restart deploy/backend
```
If your secret also held `ANTHROPIC_API_KEY`, add `--from-literal=ANTHROPIC_API_KEY=...` too, or it will be lost.

Add the button to the Savings page. In `frontend/src/views/Savings.jsx` add this import at the top:
```jsx
import PrButton from '../components/PrButton.jsx';
```
and this line right after the Dismiss button inside `rec-right`:
```jsx
<PrButton rec={r} />
```
Commit and push. CI builds new images, Jenkins promotes the new tag (Part 5), and ArgoCD deploys them. In the app, open Savings, press Scan now, then **Open PR** on an item. A link appears. The pull request holds one runbook file with the check, fix and undo commands. **Merging it does not change AWS.** After a person applies the fix and the next scan no longer lists the item, its status becomes `applied`.

## Clean up
```powershell
docker compose -f jenkins/docker-compose.yml down
kubectl delete -f gitops/apps/costpilot-dev.yaml
cd terraform\envs\dev
terraform destroy
```
Destroy removes the ECR repositories too. After the next apply, run the workflow again (Actions, CI, Run workflow) to push fresh images.

## If something fails
| Where | What you see | Fix |
|---|---|---|
| Actions, Push to ECR | `AWS_ROLE_ARN` error | Part 2 was skipped or the name is misspelled |
| Actions, Push to ECR | `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The repository name or branch is not main, or Part 1 was not applied |
| Actions, Build and scan | Trivy lists a CRITICAL vulnerability | Update the base image tag in that Dockerfile, or add a `.trivyignore` file with the CVE id |
| Actions, Terraform checks | `terraform fmt` fails | Run `terraform fmt -recursive terraform` and push |
| Jenkins | `IMAGE_TAG ... is not valid` | Copy the tag exactly from the Actions summary |
| Jenkins | `Authentication failed` when pushing | The token lacks Contents read and write, or the credential ID is not `github-token` |
| Jenkins | `rejected` when pushing | Branch protection blocks the push. Allow the token, or turn protection off for main while learning |
| ArgoCD | Sync failed with a hook error | The smoke test failed: `kubectl -n costpilot logs job/costpilot-smoke` |
| App | Open PR says GitHub is not connected | The token is not in the secret, or the backend was not restarted |
| App | Open PR says the token cannot write | Token permissions: Contents and Pull requests both need read and write, on this repository |

## Next: Week 7
Datadog dashboards and alerts, External Secrets with AWS Secrets Manager, and Argo Rollouts canary deploys.
