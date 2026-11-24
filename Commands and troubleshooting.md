# CostPilot Weeks 4 and 5: Commands and Troubleshooting

Commands for Week 4 (Terraform, EKS) and Week 5 (ECR, ArgoCD, Kubernetes), every error we hit, why it happened, how it was solved and the commands that fix it.

Run all commands in PowerShell from the project root unless a `cd` says otherwise.

Errors marked **Hit** really happened while building this project. Errors marked **Possible** did not happen yet, but are the usual ones at that step.

---

# Week 4: Terraform and EKS

## Commands

### Setup and checks

| Command | What it does |
|---|---|
| `winget install Hashicorp.Terraform` | Installs Terraform. |
| `winget install Amazon.AWSCLI` | Installs the AWS CLI. |
| `winget install Kubernetes.kubectl` | Installs kubectl. |
| `terraform -version`, `aws --version`, `kubectl version --client` | Confirms each tool is installed. Reopen PowerShell first so the PATH updates. |
| `aws configure` | Saves your access key, secret key, region (`ap-south-1`) and output format (`json`). |
| `aws sts get-caller-identity` | Shows which AWS account and user you are logged in as. Run it before creating anything. |
| `powershell -ExecutionPolicy Bypass -File .\scripts\tf-validate.ps1` | Checks the Terraform code without touching AWS. |

### Terraform

```powershell
# One-time remote state setup
cd terraform\bootstrap
terraform init
terraform apply
terraform output -raw backend_hcl_dev | Out-File -Encoding ascii ..\envs\dev\backend.hcl
Add-Content ..\..\.gitignore "terraform/**/backend.hcl"

# Dev environment
cd ..\envs\dev
$ip = (Invoke-RestMethod https://checkip.amazonaws.com).Trim()
@"
api_allowed_cidrs = ["$ip/32"]
alert_email       = "your-email@example.com"
node_desired      = 1
"@ | Out-File -Encoding ascii terraform.tfvars

terraform init -backend-config=backend.hcl
terraform plan -out tfplan
terraform apply tfplan

# Connect kubectl to the cluster
terraform output -raw kubeconfig_command | Invoke-Expression
kubectl get nodes

# Delete everything when finished
terraform destroy
```

| Command | What it does |
|---|---|
| `terraform init` (in `bootstrap`) | Downloads providers for the bootstrap stack. |
| `terraform apply` (in `bootstrap`) | Creates the remote state storage, once. |
| `terraform output -raw backend_hcl_dev \| Out-File -Encoding ascii ...\backend.hcl` | Saves the state connection settings for the dev environment. |
| `terraform init -backend-config=backend.hcl` | Connects the dev environment to that remote state. |
| `terraform plan -out tfplan` | Previews the changes and saves the plan. |
| `terraform apply tfplan` | Builds exactly the saved plan. |
| `terraform output -raw kubeconfig_command \| Invoke-Expression` | Runs the command that sets up kubectl for the new EKS cluster. |
| `kubectl get nodes` | Lists the worker nodes. They should show `Ready`. |
| `terraform destroy` | Deletes everything so AWS stops charging you. |

## Errors in Week 4

### W4-1 (Hit): `tfplan` shows as modified in `git status`

**What it means:** the saved plan file `terraform/envs/dev/tfplan` was tracked by Git. A plan file can contain account details and sensitive values, so it must never go to GitHub.

**How it was solved:** remove the file from Git (the file stays on your disk) and ignore it from now on.

**Commands:**

```powershell
git rm --cached terraform/envs/dev/tfplan
Add-Content .gitignore "terraform/**/tfplan"
Add-Content .gitignore "terraform/**/terraform.tfvars"
Add-Content .gitignore "terraform/**/*.tfstate*"
git ls-files terraform
```

The last command lists tracked Terraform files. `terraform.tfvars` or `.tfstate` must not appear. If they do, run `git rm --cached <file>` for each.

### W4-2 (Possible): `terraform` or `aws` is not recognized

**What it means:** PowerShell reads the PATH only when it starts, so a tool installed with `winget` is not found in the already open window.

**Fix:** close PowerShell, open it again, and check.

```powershell
terraform -version
aws --version
kubectl version --client
```

### W4-3 (Possible): `No valid credential sources found`

**What it means:** Terraform or the AWS CLI has no AWS login.

**Fix:**

```powershell
aws configure
aws sts get-caller-identity
```

The second command must print your account and user.

### W4-4 (Possible): `terraform init` asks for backend settings or fails

**What it means:** the dev environment cannot find its remote state settings (`backend.hcl`), or you are in the wrong folder.

**Fix:**

```powershell
cd terraform\envs\dev
dir backend.hcl
terraform init -backend-config=backend.hcl
```

If `backend.hcl` is missing or looks broken, recreate it from the bootstrap folder:

```powershell
cd ..\..\bootstrap
terraform output -raw backend_hcl_dev | Out-File -Encoding ascii ..\envs\dev\backend.hcl
```

`-Encoding ascii` avoids a Windows encoding problem that breaks the file.

### W4-5 (Possible): `UnauthorizedOperation` during `terraform apply`

**What it means:** your AWS user is missing a permission. The error text names the missing action.

**Fix:** read the action name in the error, add it to the IAM user's policy in the AWS console, then run:

```powershell
terraform plan -out tfplan
terraform apply tfplan
```

### W4-6 (Possible): `kubectl get nodes` times out

**What it means:** the EKS API only accepts your public IP (`api_allowed_cidrs`). If you changed network (Wi-Fi, mobile hotspot), your IP changed.

**Fix:** write your new IP into `terraform.tfvars` and apply again.

```powershell
cd terraform\envs\dev
$ip = (Invoke-RestMethod https://checkip.amazonaws.com).Trim()
@"
api_allowed_cidrs = ["$ip/32"]
alert_email       = "your-email@example.com"
node_desired      = 1
"@ | Out-File -Encoding ascii terraform.tfvars
terraform plan -out tfplan
terraform apply tfplan
```

### W4-7 (Possible): nodes show `NotReady`

**What it means:** the node has just been created and is still starting.

**Fix:** wait a few minutes and check again.

```powershell
kubectl get nodes
kubectl describe node <node-name>
```

### W4-8 (Possible): S3 bucket name already exists

**What it means:** S3 bucket names are global, shared by every AWS account.

**Fix:** change the bucket name variable to something unique, then plan and apply again.

### W4-9 (Possible): `terraform destroy` hangs on the VPC

**What it means:** Kubernetes created load balancers or network interfaces that Terraform does not know about, and they block the VPC from being deleted.

**Fix:** delete those leftovers in the AWS console (EC2, Load Balancers and Network Interfaces), then run:

```powershell
terraform destroy
```

---

# Week 5: ECR, ArgoCD and Kubernetes

## Commands

### Docker and ECR

| Command | What it does |
|---|---|
| `docker info` | Checks that Docker Desktop is running. |
| `aws sts get-caller-identity` | Confirms which AWS account you are logged in to. |
| `powershell -ExecutionPolicy Bypass -File .\scripts\push-images.ps1` | Logs in to ECR, builds the backend and frontend images and pushes them with a time-based tag. Prints the `registry` and `tag` for the values file. |
| `docker push <registry>/costpilot/backend:<tag>` | Pushes one image again after a failed upload. Layers already uploaded are skipped. |
| `docker build -t <registry>/costpilot/frontend:<tag> .\frontend` | Builds one image by hand. |
| `aws ecr describe-repositories --region ap-south-1 --query "repositories[].repositoryName" --output text` | Lists the ECR repository names. |

The login lines inside `scripts\push-images.ps1` must use `cmd /c`:

```powershell
$account = aws sts get-caller-identity --query Account --output text
$registry = "$account.dkr.ecr.$Region.amazonaws.com"

cmd /c "aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $registry"
if ($LASTEXITCODE -ne 0) { throw "Docker could not log in to ECR" }
```

### Git

| Command | What it does |
|---|---|
| `git status --short` | Shows changed files. `??` means a file is not in Git yet. |
| `git ls-files costpilot-gitops/charts` | Shows whether the chart is committed. Empty output means it is not. |
| `git add -A`, `git commit -m "..."`, `git push origin main` | Sends your changes to GitHub, the only place ArgoCD reads from. |

### ArgoCD and Kubernetes

| Command | What it does |
|---|---|
| `kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite` | Tells ArgoCD to reload from GitHub now. |
| `kubectl -n argocd get applications` | Shows Sync status (does the cluster match Git?) and Health status (are pods ready?). |
| `kubectl -n argocd get application costpilot-dev -o jsonpath="{.status.conditions}"` | Prints the exact error when Sync is `Unknown`. |
| `kubectl -n argocd describe application costpilot-dev` | Shows the application's path, repo, branch and events. |
| `kubectl -n argocd patch application costpilot-dev --type merge --patch-file patch.json` | Changes the source path of the running ArgoCD app. |
| `kubectl -n costpilot get pods` (add `-w` to watch) | Lists the app pods and their status. Stop watching with Ctrl + C. |
| `kubectl -n costpilot get deploy <name> -o jsonpath="{.spec.template.spec.containers[0].image}"` | Shows which image a deployment really uses. |
| `kubectl -n costpilot logs deploy/backend --tail 30` | Shows the last log lines of a pod. |
| `kubectl -n costpilot describe pod <pod-name>` | Shows pod events, which explain pull and start errors. |
| `kubectl -n costpilot get secret costpilot-secrets` | Checks that the secret the chart needs exists. |
| `kubectl -n costpilot port-forward svc/frontend 8081:80` | Opens the app at http://localhost:8081. |

### Finding text in files

```powershell
Get-ChildItem -Recurse -File -Include *.tf,*.yaml,*.yml,*.ps1,*.md -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "node_modules|\\.terraform\\|\\.git\\" } |
  Select-String -Pattern "text to find" |
  Select-Object Path, LineNumber, Line
```

## Errors in Week 5

### W5-1 (Hit): `login attempt to ECR failed with status: 400 Bad Request`

**What it means:** Docker could not log in to ECR. In PowerShell the pipe (`|`) between `aws ecr get-login-password` and `docker login` adds extra characters to the password, so ECR rejects it.

**How it was solved:** run the pipe inside `cmd` instead of PowerShell. The script now does this.

**Commands:**

```powershell
cmd /c "aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com"
```

Expected output: `Login Succeeded`. Inside `push-images.ps1` the same line uses `$Region` and `$registry` instead of the real values.

### W5-2 (Hit): `argument --region: expected one argument` and `password is empty`

**What it means:** the login line was pasted straight into the terminal. `$Region` and `$registry` are variables that only exist inside the script, so in the terminal they are empty and `--region` gets no value.

**How it was solved:** put the line inside `scripts\push-images.ps1` and run the script file, not the line.

**Commands:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-images.ps1
```

### W5-3 (Hit): `timeout awaiting response headers` during `docker push`

**What it means:** the upload to ECR stopped halfway because of a network timeout. It is not a code or AWS problem.

**How it was solved:** push again. Docker skips the layers that already uploaded, so the retry is fast.

**Commands:**

```powershell
docker push <registry>/costpilot/backend:<tag>
```

If it keeps timing out, turn off VPN or try another network. You can also limit parallel uploads: Docker Desktop, Settings, Docker Engine, add this line at the top level of the JSON (with a comma after the previous line), then Apply & restart:

```json
"max-concurrent-uploads": 1
```

### W5-4 (Hit): `Select-String: A parameter cannot be found that matches parameter name 'Recurse'`

**What it means:** `Select-String` can not search folders by itself, so it has no `-Recurse` option.

**How it was solved:** list the files with `Get-ChildItem -Recurse` and pass them to `Select-String`.

**Commands:** the "Finding text in files" block above.

### W5-5 (Hit): ArgoCD `app path does not exist`, Sync `Unknown`

**What it means:** ArgoCD reads only GitHub, and it could not find the chart folder there. The folder `costpilot-gitops/charts` existed on the laptop but was never committed (it showed as `??` in `git status`). A wrong path (`gitops/...`, then `base/costpilot`) was also used for a while.

**How it was solved:** commit and push the chart, and point the ArgoCD app at the real path.

**Commands:**

```powershell
git status --short
git ls-files costpilot-gitops/charts
git add -A
git commit -m "Add helm chart and set dev image tag"
git push origin main

'{"spec":{"source":{"path":"costpilot-gitops/charts/costpilot"}}}' | Out-File -Encoding ascii patch.json
kubectl -n argocd patch application costpilot-dev --type merge --patch-file patch.json
Remove-Item patch.json

kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite
kubectl -n argocd get applications
```

Also check that `costpilot-gitops/apps/costpilot-dev.yaml` has `path: costpilot-gitops/charts/costpilot`, so the old path does not come back. To read the exact error at any time:

```powershell
kubectl -n argocd get application costpilot-dev -o jsonpath="{.status.conditions}"
```

### W5-6 (Hit): pods `InvalidImageName` with `YOUR_AWS_ACCOUNT_ID...:REPLACE_WITH_IMMUTABLE_TAG`

**What it means:** the pods used an image name that still held placeholder text. The cluster was running old manifests from the wrong path, not the chart and `values.yaml` you had edited.

**How it was solved:** after the real chart and values were pushed and ArgoCD used the right path, it replaced the old pods with `backend`, `frontend` and `mongo`.

**Commands:**

```powershell
kubectl -n costpilot get deploy costpilot-api -o jsonpath="{.spec.template.spec.containers[0].image}"
git add -A
git commit -m "Fix dev image registry and tag"
git push origin main
kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite
kubectl -n costpilot get pods -w
```

The first command shows the image a deployment really uses. After the fix, pods go `ContainerCreating` and then `Running`.

### W5-7 (Possible): pods `ImagePullBackOff`

**What it means:** the node could not pull the image from ECR. Usual reasons: wrong repository name or tag, or the node role has no permission to read ECR.

**Fix:**

```powershell
kubectl -n costpilot describe pod <pod-name>
aws ecr describe-repositories --region ap-south-1 --query "repositories[].repositoryName" --output text
aws ecr describe-images --repository-name costpilot/backend --region ap-south-1 --query "imageDetails[].imageTags"
```

The `Events` part of `describe pod` names the exact reason. Check that the repository names match the chart (`costpilot/backend`, `costpilot/frontend`), that the tag in `envs/dev/values.yaml` is in the ECR list, and that the node group's IAM role has the `AmazonEC2ContainerRegistryReadOnly` policy.

### W5-8 (Possible): pods `CreateContainerConfigError`

**What it means:** the pod needs a secret that does not exist.

**Fix:**

```powershell
kubectl -n costpilot get secret costpilot-secrets
$jwt = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
kubectl -n costpilot create secret generic costpilot-secrets `
  --from-literal=JWT_SECRET=$jwt `
  --from-literal=MONGO_URI="mongodb://mongo:27017/costpilot"
kubectl -n costpilot rollout restart deploy/backend
```

Run the `create secret` command only if the first command says `NotFound`.

### W5-9 (Possible): Health stays `Progressing` or a pod stays `0/1`

**What it means:** the container started but is not ready, for example the backend still waits for MongoDB.

**Fix:** wait one or two minutes, then read the logs.

```powershell
kubectl -n costpilot get pods
kubectl -n costpilot logs deploy/backend --tail 30
kubectl -n costpilot logs deploy/mongo --tail 20
```

The backend log should show `MongoDB connected` and `API listening on :5000`.

---

# Status words

| Status | Meaning |
|---|---|
| **Synced** | The cluster matches what is in Git. |
| **OutOfSync** | Git and the cluster differ. With auto-sync on, ArgoCD fixes this itself. |
| **Unknown** | ArgoCD could not read Git. Check the `conditions` message. |
| **Progressing** | Pods are starting but are not `Ready` yet. Normal for a minute or two. |
| **Healthy** | All pods are ready. |
| `InvalidImageName` | The image name is empty or still a placeholder. |
| `ImagePullBackOff` | The node cannot pull the image. |
| `CreateContainerConfigError` | A secret or config the pod needs is missing. |

# Rules to remember

1. ArgoCD only reads GitHub. Any change must be committed and pushed.
2. Run script lines through the script file. Do not paste them into the terminal.
3. Never commit `.env`, `backend.hcl`, `terraform.tfvars`, `*.tfstate`, `tfplan` or any access key.
4. Run `terraform destroy` when you finish for the day, because EKS costs money while idle.
5. If your public IP changes, `kubectl` times out. Update `api_allowed_cidrs` and run `terraform apply` again.