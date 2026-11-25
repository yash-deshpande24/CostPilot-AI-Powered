# Week 6: GitHub Actions, Jenkins and automatic pull requests

**Goal:** every change is checked automatically, a merge to `main` ships new images to the cluster
without typing `kubectl`, and CostPilot can open a pull request for a waste finding so a person
reviews and approves the fix.

## How the pieces fit

```
you push a branch  ->  GitHub Actions "CI"            tests, frontend build, terraform validate, helm lint, docker build
you merge to main  ->  GitHub Actions "Deploy dev"    build + push images to ECR, commit the new tag to Git
                                                            |
                                                            v
                       ArgoCD sees the tag in costpilot-gitops/envs/dev/values.yaml  ->  rolls out the new pods

Savings tab -> "Open PR"  ->  POST /api/recommendations/:id/pr
      -> CostPilot creates a branch, adds ONE file costpilot-gitops/remediations/<kind>-<resource>.yaml
      -> opens a pull request with the saving, the risk and a checklist
      -> a person merges it; GET /api/prs then marks the finding "applied"
```

CostPilot has **no AWS permissions of its own** for this. The pull request is the approval step.
Nothing is deleted or stopped until a person acts on it.

## Files added in Week 6

```
.github/workflows/ci.yml                    tests, build, terraform, helm, docker build (no push)
.github/workflows/deploy-dev.yml            build + push to ECR, then commit the tag to Git
Jenkinsfile                                 same checks + tag promotion, for Jenkins
jenkins/Dockerfile, jenkins/plugins.txt     a Jenkins image with git, node, docker, aws, terraform, helm
terraform/github-oidc/                      IAM role so GitHub Actions can push to ECR with no AWS keys
backend/src/services/pr/                    config, normalize, buildPr, github, sync (.cjs so it works either module style)
backend/src/models/PullRequestRecord.cjs    one record per pull request
backend/src/routes/prs.cjs                  POST /api/recommendations/:id/pr, GET /api/prs, GET /api/prs/status
backend/src/tests/pr.test.cjs               13 tests for the new code
frontend/src/components/PrButton.jsx        the "Open PR" button on the Savings tab
scripts/set-image-tag.ps1 / .sh             changes image.tag safely (validates the tag, keeps comments)
scripts/smoke-test-week6.ps1                end-to-end API check
docs/week6.md                               this file
```

Already wired for you: the router is mounted in `backend/src/index.js`, the button is used in
`frontend/src/views/Savings.jsx`, and the chart passes the settings to the pods.

## Before you start

- Docker Desktop running (you need it for local runs and for the Jenkins image).
- Week 4 cluster up: `kubectl get nodes` shows one node `Ready`.
- `aws sts get-caller-identity` works.
- You are in the project root: `C:\Users\deshp\OneDrive\Desktop\Projects\CostPilot-AI-Powered`.

---

## Step 0: fix the ArgoCD chart path (one time)

Week 5's Application pointed at `gitops/charts/costpilot`, but the folder in the repo is
`costpilot-gitops/charts/costpilot`. That is why ArgoCD said *app path does not exist*.
The file is fixed now; re-apply it so the cluster picks up the correct path:

```powershell
kubectl apply -f costpilot-gitops/apps/costpilot-dev.yaml
kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite
kubectl -n argocd get applications
```

Wait 30 to 60 seconds. `SYNC STATUS` should become `Synced` and `HEALTH STATUS` `Healthy`.
If it stays `Unknown`, read the reason:

```powershell
kubectl -n argocd get application costpilot-dev -o jsonpath="{.status.conditions[*].message}"
```

---

## Step 1: try the feature locally in mock mode (no token)

With no `GITHUB_TOKEN`, the app builds the pull request, shows it, and sends nothing. Same idea as
the mock cost data in Week 2, so it is safe to click.

```powershell
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-week6.ps1
```

Expected output ends with `Week 6 smoke test passed.` and `PR mode: mock`.

In the app:

1. Open http://localhost:8080 and sign in.
2. **Savings** tab, click **Scan now**.
3. On a finding, click **Open PR**. You should see **Preview only** and a
   "what would open" link showing the YAML file that would be committed.

Check what was stored:

```powershell
# sign in first and keep the token, or just use the app
Invoke-RestMethod http://localhost:5000/api/prs/status -Headers @{ Authorization = "Bearer <token>" }
```

---

## Step 2: turn on real pull requests

1. GitHub, top right, **Settings**, **Developer settings**, **Personal access tokens**,
   **Fine-grained tokens**, **Generate new token**:
   - Repository access: **Only select repositories** -> `CostPilot-AI-Powered`
   - Permissions: **Contents: Read and write**, **Pull requests: Read and write**
   - Expiration: 90 days
2. Add it to `.env` (never commit `.env`):

   ```powershell
   Add-Content .env 'GITHUB_TOKEN=github_pat_PASTE_YOURS'
   Add-Content .env 'GITHUB_REPO=yash-deshpande24/CostPilot-AI-Powered'
   ```

3. Recreate the backend so it reads the new values:

   ```powershell
   docker compose up -d --build backend
   ```

4. In the app: **Scan now**, then **Open PR** on a finding. A real pull request opens on GitHub,
   with a new file under `costpilot-gitops/remediations/`.

5. Merge the pull request on GitHub, then reload the Savings tab (or call `GET /api/prs`).
   The finding's status becomes `applied`.

> On the cluster the same settings come from the chart. To enable real PRs there, add the token to
> the existing secret and restart the pods:
>
> ```powershell
> kubectl -n costpilot patch secret costpilot-secrets --type merge `
>   -p '{\"stringData\":{\"GITHUB_TOKEN\":\"github_pat_PASTE_YOURS\"}}'
> kubectl -n costpilot rollout restart deploy/backend
> ```

---

## Step 3: GitHub Actions

### 3.1 Create the OIDC role (once)

This lets GitHub Actions push to ECR with a short-lived token instead of stored AWS keys.

```powershell
cd terraform\github-oidc
terraform init
terraform apply
```

Copy the `role_arn` output. If AWS says the OIDC provider already exists:

```powershell
terraform apply -var create_oidc_provider=false
```

Back to the project root:

```powershell
cd ..\..
```

### 3.2 Add the secret in GitHub

GitHub -> your repository -> **Settings** -> **Secrets and variables** -> **Actions** ->
**New repository secret**:

- Name: `AWS_ROLE_ARN`
- Value: the `role_arn` from the previous step

### 3.3 Push your work

```powershell
git status
git add .
git commit -m "feat: week 6 - ci/cd and automatic pull requests"
git push
```

`.env`, `terraform.tfvars`, `backend.hcl` and `*.tfstate` must **not** appear in `git status`.

### 3.4 Watch the runs

GitHub -> **Actions**:

| Workflow | When | What to expect |
|---|---|---|
| `CI` | every push and pull request | backend tests (23 + 13), frontend build, terraform validate, helm lint, docker build |
| `Deploy dev` | a push to `main` that touches `backend/` or `frontend/` | images pushed to ECR, then a commit `ci: set dev image tag ...` |

Open the `Deploy dev` run and read the summary: it shows the tag and the two image names.
Then check the cluster:

```powershell
git pull
Select-String -Path costpilot-gitops\envs\dev\values.yaml -Pattern "tag:"
kubectl -n argocd get applications
kubectl -n costpilot get pods
kubectl -n costpilot get deploy backend -o jsonpath="{.spec.template.spec.containers[0].image}"
```

ArgoCD polls Git about every 3 minutes, or force it:

```powershell
kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite
```

> `Deploy dev` fails with *Resource not accessible by integration* if the repository does not allow
> the workflow to push: **Settings** -> **Actions** -> **General** -> **Workflow permissions** ->
> **Read and write permissions** -> Save.

---

## Step 4: Jenkins

Jenkins promotes a tested tag by committing it to `costpilot-gitops/envs/<env>/values.yaml`.
It does not touch the cluster; ArgoCD does that. The image below has git, Node 20, Docker CLI,
AWS CLI, Terraform and Helm, plus the plugins the `Jenkinsfile` needs.

### 4.1 Build and start Jenkins

```powershell
docker build -t costpilot-jenkins .\jenkins
docker run -d --name jenkins --user root -p 8080:8080 -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v //var/run/docker.sock:/var/run/docker.sock `
  costpilot-jenkins
```

The first build takes 3 to 5 minutes. Get the unlock password:

```powershell
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open http://localhost:8080, paste the password, choose **Install suggested plugins** (the ones this
pipeline needs are already baked in), then create your admin user.

> `--user root` is only for a local demo: it lets the container use the Docker socket so the
> pipeline can build images. Do not do this on a shared server.

### 4.2 Add two credentials

**Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials** -> **Add Credentials**:

| Kind | ID | Value |
|---|---|---|
| Username with password | `github-gitops` | GitHub username + a fine-grained token with **Contents: Read and write** |
| AWS Credentials | `aws-costpilot` | Access key of a user allowed to push to ECR (only needed for `PUSH_IMAGES`) |

### 4.3 Create the job

**New Item** -> name `costpilot-promote` -> **Pipeline** -> OK:

- **Pipeline** -> Definition: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: `https://github.com/yash-deshpande24/CostPilot-AI-Powered.git`
- Credentials: `github-gitops`
- Branch Specifier: `*/main`
- Script Path: `Jenkinsfile`

Save, then **Build with Parameters**.

### 4.4 First run: checks only

Leave `IMAGE_TAG` empty and `PUSH_IMAGES` unticked, click **Build**. You should see:

- Backend tests, Frontend build, Helm lint (in parallel)
- Terraform validate
- The build and push / promote stages skipped

A green build means Jenkins can build your project.

### 4.5 Promote a tag

1. Copy the tag from the `Deploy dev` summary in GitHub Actions, for example
   `20261125-101500-1a2b3c4`.
2. In Jenkins: **Build with Parameters**, paste it into `IMAGE_TAG`, choose `TARGET_ENV` = `dev`,
   leave `PUSH_IMAGES` unticked, **Build**.

Jenkins commits `ci: promote <tag> to dev` and pushes to `main`. Then:

```powershell
git pull
git log --oneline -3
kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite
kubectl -n costpilot get pods
```

`TARGET_ENV` = `prod` asks for a confirmation click first (the **Approve prod** stage).

### 4.6 Optional: let Jenkins build and push too

Tick `PUSH_IMAGES` and leave `IMAGE_TAG` empty. Jenkins builds its own tag
(`yyyyMMdd-HHMMSS-<short sha>`), pushes both images, then commits the tag. This needs the
`aws-costpilot` credential and a working Docker socket in the container.

---

## Step 5: the whole loop, end to end

```powershell
# 1. a code change
#    edit frontend/src/views/Savings.jsx (for example the button text)
git add .
git commit -m "feat: try the ci loop"
git push
```

Then watch, in order:

1. GitHub Actions **CI** turns green.
2. GitHub Actions **Deploy dev** pushes images and commits the tag.
3. `git pull` shows the tag commit.
4. ArgoCD syncs (about 3 minutes) and the pods restart.
5. The change is visible at http://localhost:8090 (port-forward) or through your ingress.

```powershell
kubectl -n costpilot port-forward svc/frontend 8090:80
```

---

## How "applied" works

- `POST /api/recommendations/:id/pr` opens the pull request and sets the finding to `pr_opened`
  with its `prUrl`.
- `GET /api/prs` checks every open pull request on GitHub:
  - **merged** -> the finding becomes `applied` (`appliedAt` is set)
  - **closed without merging** -> the finding goes back to `new`
- The daily scan does the same check for a different reason: if a finding with an open pull request
  is no longer found in AWS, the fix probably landed, so it becomes `applied`.

Only one open pull request per finding is allowed, and each user has a daily limit
(`PR_DAILY_LIMIT`, default 10, resets at midnight UTC).

---

## Safety

- CostPilot can only open a pull request. It cannot change AWS.
- The GitHub token is never logged and never returned in an error message.
- GitHub Actions uses a short-lived OIDC role, limited to `costpilot/*` repositories and the
  `main` branch.
- `set-image-tag` validates the tag with `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` before it is written,
  so a value like `$(whoami)` cannot reach Git or a shell.
- Never commit `.env`, tokens, `terraform.tfvars`, `backend.hcl`, `*.tfstate` or `tfplan`.

## Cost and cleanup

- The cluster and NAT gateway cost about **$5 to $8 a day**. GitHub Actions minutes are free for
  public repositories and included for private ones. Jenkins runs locally in Docker (about 1 GB RAM).
- Stop for the day:

  ```powershell
  kubectl delete -f costpilot-gitops/apps/costpilot-dev.yaml
  cd terraform\envs\dev
  terraform destroy
  ```

- Stop Jenkins without losing its settings:

  ```powershell
  docker stop jenkins
  docker start jenkins
  ```

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| ArgoCD `app path does not exist` | The Application still points at `gitops/...`. Re-apply `costpilot-gitops/apps/costpilot-dev.yaml` (Step 0). |
| Actions: `Could not assume role` | `AWS_ROLE_ARN` secret missing or wrong, or the push is not to `main`, or `github_repo` in `terraform/github-oidc` does not match your repository. |
| Actions: `Resource not accessible by integration` | Settings -> Actions -> General -> Workflow permissions -> Read and write. |
| Actions: `npm ci` fails | `package-lock.json` is out of date. Run `npm install` in that folder locally and commit the lock file. |
| Actions: helm `required value` error | `image.registry` or `image.tag` is empty in `costpilot-gitops/envs/dev/values.yaml`. |
| Actions: ECR `denied` | The role only allows `costpilot/*` repositories. Check the repo names in ECR. |
| Deploy dev: nothing happened | The workflow only runs when `backend/` or `frontend/` changed. Use **Run workflow** to force it. |
| Jenkins: `sh: not found` | Use the image in `jenkins/Dockerfile`, not a bare `jenkins/jenkins` image. |
| Jenkins: `docker: permission denied` | Start the container with `--user root`, or add the docker group. |
| Jenkins: push rejected `403` | The `github-gitops` token needs **Contents: Read and write** on this repository (and SSO authorization if the org uses it). |
| Jenkins: `Nothing to promote` | Git already has that tag in that environment. |
| Jenkins: `Tag ... is not a valid Docker tag` | Use the exact tag from the Actions summary; no spaces, `$`, or quotes. |
| Button says **Preview only** | No `GITHUB_TOKEN` in the running backend. Add it to `.env` and `docker compose up -d --build backend`, or patch the cluster secret. |
| `409 A pull request is already open` | Merge or close that pull request first; the response contains its link. |
| `401 GitHub rejected the token` | Token expired or revoked. Create a new one. |
| `403 GitHub refused the request` | Token lacks Contents or Pull requests write access, or you hit a rate limit. |
| `404 GitHub could not find the repository` | Check `GITHUB_REPO` (`owner/name`) and `GITHUB_BASE_BRANCH`. |
| `429` daily limit | Wait for midnight UTC or raise `PR_DAILY_LIMIT`. |
| Finding never becomes `applied` | `GET /api/prs` does the check. Confirm the PR is merged and the token can read it. |

## Checklist

- [ ] `kubectl get nodes` shows one node `Ready`
- [ ] ArgoCD application is `Synced` / `Healthy` with the `costpilot-gitops/...` path
- [ ] `node --test src/tests/pr.test.cjs` passes (13 tests)
- [ ] `scripts/smoke-test-week6.ps1` passes (mock mode is fine)
- [ ] `terraform/github-oidc` applied, `AWS_ROLE_ARN` secret added
- [ ] `CI` workflow green on a push
- [ ] `Deploy dev` pushed a tag and committed it
- [ ] Jenkins job green with checks only
- [ ] Jenkins promoted a tag and the pods restarted
- [ ] A real pull request opened and merged, and the finding became `applied`
