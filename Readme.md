# CostPilot

**AI-powered FinOps platform for AWS cost optimization.**
CostPilot finds wasted AWS spend, explains it in plain English with AI, and opens a pull request on your Terraform/GitOps repo to fix it. After a human approves, ArgoCD applies the change.

**Stack:** React, Node.js/Express, MongoDB, AWS (EKS, ECR, S3, SQS, Cost Explorer), Docker, Kubernetes, Terraform, GitHub Actions, Jenkins, ArgoCD (GitOps), Datadog, Claude API.

## Progress

| Week | Focus | Status |
|---|---|---|
| 1 | Login, mock cost dashboard, spike detection, Docker Compose | Done |
| 2 | AWS Cost Explorer, waste scanners, savings recommendations, new UI | Done |
| 3 | Claude API: explain spikes, rank savings, chat with your bill | Done |
| 4 | Terraform (VPC, EKS, ECR, S3, SQS, IAM) | Done |
| 5 | Helm + ArgoCD on EKS, daily scan CronJob | Done |
| 6 | GitHub Actions + Jenkins, automatic PR generation | Planned |
| 7 | Datadog, External Secrets, Argo Rollouts | Planned |
| 8 | Polish, architecture diagram, demo video | Planned |

---

# Week 1: Foundation

**Goal:** a working app you can run with one command: login, a cost dashboard on sample data, and spike detection.

## What was built

- **React frontend** (Vite) served by nginx in Docker.
- **Express API** with JWT login (`register`, `login`, `me`). Passwords are hashed with bcrypt.
- **MongoDB** for users.
- **Mock cost data**: a deterministic fake AWS bill (EC2, EKS, RDS, S3, Data Transfer, CloudWatch) with a planted spike, so the UI works without an AWS account.
- **Spike detection**: a day is flagged when it is more than 35% above the average of the previous 7 days. The API also names the service that drove it.
- **Docker Compose** that starts frontend, backend and MongoDB together.

## Week 1 files

```
backend/src/index.js              API entry point, /health
backend/src/routes/auth.js        register, login, me
backend/src/middleware/auth.js    JWT check (requireAuth)
backend/src/models/User.js        user model
backend/src/services/mockCosts.js sample cost generator
backend/src/services/anomaly.js   spike detection
frontend/src/pages/Login.jsx      sign in / create account
frontend/src/pages/Dashboard.jsx  dashboard shell
docker-compose.yml                frontend + backend + mongo
```

## Week 1 API

| Method | Path | Description |
|---|---|---|
| GET | /health | Liveness check |
| POST | /api/auth/register | Create account, returns a JWT (password 8+ characters) |
| POST | /api/auth/login | Sign in, returns a JWT |
| GET | /api/auth/me | Current user |
| GET | /api/costs?days=30 | Daily spend, per-service totals, anomalies |

---

# Week 2: Real AWS data and waste scanners

**Goal:** connect to a real AWS account (read-only), find wasted resources, and show how much money could be saved.

## What was added

- **`COST_SOURCE=mock|aws` switch.** `mock` uses sample data and fake AWS resources. `aws` uses Cost Explorer and read-only scans.
- **Cost Explorer client** that turns AWS results into the same shape as the mock data (friendly service names, credits and refunds excluded, pagination handled).
- **Caching in MongoDB** (`CACHE_HOURS`, default 24) because each Cost Explorer API call costs about $0.01.
- **Three waste scanners:**
  - Unattached EBS volumes (price = size x per-GB rate by volume type)
  - Unused Elastic IPs (about $3.65 a month each)
  - Idle EC2 instances (average CPU under 5% and peak under 20% over 14 days, using CloudWatch)
- **Mock AWS clients** with the same `send(command)` shape as the real SDK, so mock mode runs the real scanner code.
- **Recommendations** stored in MongoDB with a monthly savings estimate and a status (`new`, `dismissed`, `resolved`, ...). Dismissed items stay dismissed on later scans; items that are no longer found become `resolved`.
- **Custom date ranges** (`from` / `to`) for sample data, plus 30/60/90 day presets.
- **New dashboard** with Overview, Services, Calendar and Savings views, a "Scan now" button, a Sample data / Live AWS data label, light and dark theme, CSV export and a quick-action dock.
- **Tests** for anomaly detection, Cost Explorer parsing and the scanners.
- **GitOps skeleton** (`costpilot-gitops/`): Helm chart and Argo CD ApplicationSet for dev, staging and prod. Deployment config only; it is wired up in Weeks 5 to 7.

## Week 2 files

```
backend/src/services/awsCost.js            Cost Explorer client
backend/src/services/costSource.js         mock/aws switch + cache
backend/src/services/scanners/             ebs.js, eip.js, ec2Idle.js, index.js, mockAws.js
backend/src/services/recommendations.js    save scan results
backend/src/models/Recommendation.js       recommendation model
backend/src/models/CostCache.js            cache model
backend/src/routes/scan.js                 POST /api/scan
backend/src/routes/recommendations.js      list / dismiss
backend/src/tests/                         anomaly, awsCost, scanners tests
frontend/src/views/                        Home, Overview, Services, Calendar, Savings
frontend/src/components/                   QuickBar, RangeBar
docker-compose.override.yml                passes Week 2 settings to the backend
docs/iam-policy.json                       read-only IAM policy
docs/week2.md                              Week 2 notes
scripts/smoke-test.ps1                     end-to-end API check
costpilot-gitops/                          Helm + Argo CD config
```

## Week 2 API

All `/api` routes except register and login need `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | /api/costs?days=30 | Daily spend from mock or AWS (14 to 90 days) |
| GET | /api/costs?from=YYYY-MM-DD&to=YYYY-MM-DD | Custom range (mock mode only, 400 days max) |
| POST | /api/scan | Run all scanners and save findings |
| GET | /api/recommendations | Active findings, biggest savings first |
| PATCH | /api/recommendations/:id | Body `{"status":"dismissed"}` or `{"status":"new"}` |

## Switching to real AWS

1. In AWS IAM, create a user with the read-only policy in [docs/iam-policy.json](docs/iam-policy.json) and create an access key.
2. In AWS Billing, open Cost Explorer once so AWS enables it. Data can take up to 24 hours to appear.
3. In `.env`, set `COST_SOURCE=aws`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
4. Run `docker compose up -d --build`.

The dashboard label changes from "Sample data" to "Live AWS data". Savings are estimates: a per-GB rate for EBS, a flat price for Elastic IPs and a small on-demand price table for EC2. Never commit `.env`.

---

# Week 3: Claude explains, ranks and answers

**Goal:** add AI on top of the cost data. Claude explains why a day was expensive, decides which savings to do first, and answers questions about your bill. Everything also works with no API key.

## What was added

- **Explain this** on every unusual day in the Overview tab. Returns a short summary, possible causes, things to check in AWS, and a confidence level.
- **Rank with AI** on the Savings tab. Orders the waste findings and gives each one a priority number, a risk level (low / medium / high), an effort level (minutes / hours / days) and a one-line reason. AI-ranked items are shown first.
- **Ask AI** tab: a chat about your bill ("Which service costs the most?"). The last messages are saved per user and can be cleared.
- **Sample mode (no key needed).** With no `ANTHROPIC_API_KEY`, every AI feature still works using answers built from your own numbers. Nothing is sent anywhere. The Ask AI tab shows which mode is active.
- **Real Claude mode.** Set `ANTHROPIC_API_KEY` and the same features are answered by Claude (default model `claude-haiku-5-5`). Explain and Rank use structured tool output, and the server checks the result before saving it.
- **Daily limit.** `AI_DAILY_LIMIT` (default 30) caps AI requests per user per day. Explain, rank and chat each count as one. The limit resets at midnight UTC.
- **Usage tracking.** Calls and token counts per user per day are stored, ready for the Week 7 Datadog dashboard. Set both price variables to see an estimated daily AI cost.
- **Caching.** An explanation of the same day with the same spend is saved for 7 days, so asking twice costs nothing.
- **Friendly errors.** A bad key, a rate limit or a wrong model name each show a clear message. The raw error is logged on the server and never shown.
- **Tests and smoke test** for the AI code.

## Safety

- The AI only advises. It has no access to AWS and cannot change anything.
- AWS text such as resource names and tags is sent inside tags, and the prompt tells Claude to treat it as data, not instructions.
- Your API key stays on the server and never reaches the browser. Error messages never include it.
- Requests are limited per user per day.
- It uses only the numbers it is given. If the data does not contain the answer, it says so.

## Using the real Claude API

1. Create an API key in the Anthropic Console (console.anthropic.com).
2. In `.env`, set `ANTHROPIC_API_KEY=...`. Optionally set `ANTHROPIC_MODEL`.
3. Run `docker compose up -d --build`.
4. Open the **Ask AI** tab. It should say "Answers written by Claude". `http://localhost:5000/health` now shows `"ai":"claude"`.
5. Never commit `.env`.

To go back to free sample answers, empty `ANTHROPIC_API_KEY` (or set `AI_MODE=mock`) and rebuild.

## Week 3 files

```
backend/src/services/ai/index.js       explainSpend, rankRecommendations, chatWithBill
backend/src/services/ai/claude.js      Anthropic SDK call, tool output, retry, token count
backend/src/services/ai/prompts.js     system prompts and the two tool schemas
backend/src/services/ai/context.js     builds the bill summary and one-day detail
backend/src/services/ai/mock.js        free sample answers built from your numbers
backend/src/services/ai/usage.js       daily limit, token counts, cost estimate
backend/src/services/ai/errors.js      friendly error messages
backend/src/services/ai/config.js      AI mode, model, daily limit
backend/src/services/ai/fmt.js         money formatting helper
backend/src/models/AiUsage.js          calls and tokens per user per day
backend/src/models/AiCache.js          saved explanations (7 days)
backend/src/models/ChatMessage.js      saved chat history
backend/src/models/Recommendation.js   adds aiPriority, aiRisk, aiEffort, aiReason, aiRankedAt
backend/src/routes/ai.js               /api/ai/* routes
backend/src/routes/recommendations.js  AI-ranked items sorted first
backend/src/tests/ai.test.js           AI tests
frontend/src/views/Ask.jsx             chat tab
frontend/src/components/ExplainCard.jsx   "Explain this" card
frontend/src/views/Overview.jsx        Explain this on unusual days
frontend/src/views/Savings.jsx         Rank with AI, priority, risk and effort chips
scripts/smoke-test-week3.ps1           end-to-end AI check
docs/week3.md                          Week 3 notes
```

## Week 3 API

All routes need `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | /api/ai/status | Mode, model, requests used today, limit, tokens, estimated cost |
| POST | /api/ai/explain | Body `{"date":"2026-11-13"}`. Explains one day |
| POST | /api/ai/rank | Ranks the active waste findings and saves the ranking |
| POST | /api/ai/chat | Body `{"question":"..."}` (up to 500 characters) |
| GET | /api/ai/chat | Read your chat history (last 50 messages) |
| DELETE | /api/ai/chat | Clear your chat history |

`GET /health` now also returns `"ai": "mock"` or `"claude"`.

Common responses: `400` empty question, bad date or nothing to rank (run a scan first), `404` no data for that date, `429` daily limit reached, `502` Claude key rejected, rate limited or unreachable.

---

# Week 4: Infrastructure as Code with Terraform

**Goal:** describe all the AWS infrastructure CostPilot needs as Terraform code, so the whole environment can be created, reviewed and destroyed with a few commands. This is also the code that CostPilot's pull requests will change in Week 6.

## What was added

- **VPC** with public and private subnets, an internet gateway and routing.
- **EKS cluster** with a managed node group. ArgoCD and the app are deployed onto it in Week 5.
- **ECR repositories** for the frontend and backend Docker images.
- **S3 bucket** for reports and exports.
- **SQS queue** for scan jobs. The Week 5 worker reads from it.
- **IAM roles and policies** for the cluster, the nodes and the app, following least privilege.
- **Bootstrap stack** (`terraform/bootstrap`) that is applied once and creates the remote Terraform state storage. It prints a ready-made `backend.hcl` so the dev environment stores its state remotely instead of on your laptop.
- **Dev environment** (`terraform/envs/dev`) that builds everything above for development. It is configured with a small `terraform.tfvars` file.
- **Safe defaults:** the EKS API is reachable only from your own IP (`api_allowed_cidrs`), the cluster starts with a single node (`node_desired = 1`) to keep cost low, and an alert email can be set (`alert_email`).
- **Validation script** (`scripts/tf-validate.ps1`) that checks the Terraform code without creating anything.

## Week 4 files

```
terraform/bootstrap/            one-time setup: remote state storage, prints backend_hcl_dev
terraform/envs/dev/             dev environment (VPC, EKS, ECR, S3, SQS, IAM)
terraform/envs/dev/backend.hcl  generated by bootstrap (not committed)
terraform/envs/dev/terraform.tfvars  your own values: IP, email, node count (not committed)
scripts/tf-validate.ps1         checks the Terraform code
docs/week4.md                   Week 4 notes
```

## Before you start

You need an AWS account and an IAM user with an access key that is allowed to create these resources. Run every command in PowerShell from the project root unless a `cd` says otherwise.

> **Cost warning:** EKS costs money while it exists, even when idle (the control plane is about $0.10 an hour, plus the worker node). Always run `terraform destroy` when you finish for the day, and check the AWS Billing page. This is exactly the kind of waste CostPilot is built to find.

## Step 1: Install the tools

```powershell
winget install Hashicorp.Terraform
winget install Amazon.AWSCLI
winget install Kubernetes.kubectl
```

Close PowerShell and open it again so the new commands are found, then check:

```powershell
terraform -version
aws --version
kubectl version --client
```

*Why:* Terraform builds the infrastructure, the AWS CLI lets you log in to AWS and fetch the cluster login, and kubectl talks to the Kubernetes cluster. Reopening PowerShell is needed because the PATH is only read when it starts.

## Step 2: Connect to AWS

```powershell
aws configure
```

Enter these when asked:

```
AWS Access Key ID [None]: <your access key id>
AWS Secret Access Key [None]: <your secret key>
Default region name [None]: ap-south-1
Default output format [None]: json
```

Check that it works:

```powershell
aws sts get-caller-identity
```

*Why:* Terraform uses these credentials to create resources in your account. `ap-south-1` (Mumbai) is the region used in this project. `get-caller-identity` prints the account and user you are logged in as, so you can confirm you are in the right account before creating anything. Never put your keys in the repo.

## Step 3: Check the code

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tf-validate.ps1
```

*Why:* this checks the Terraform code for syntax and formatting mistakes without touching AWS, so it is free and safe to run any time.

## Step 4: Bootstrap (remote state)

```powershell
cd terraform\bootstrap
terraform init
terraform apply

terraform output -raw backend_hcl_dev | Out-File -Encoding ascii ..\envs\dev\backend.hcl
Add-Content ..\..\.gitignore "terraform/**/backend.hcl"
```

*Why:* Terraform keeps a "state" file that records what it has built. Storing it remotely is safer than keeping it on one laptop and lets a team (and later GitHub Actions) share it. The bootstrap stack creates that storage once. Its output `backend_hcl_dev` is the connection settings, saved as `backend.hcl` in the dev folder. The `.gitignore` line keeps that file out of Git. `Out-File -Encoding ascii` avoids a Windows encoding problem that can break the file.

## Step 5: Build the dev environment

```powershell
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
```

*Why:*

| Setting | Meaning |
|---|---|
| `api_allowed_cidrs` | Only your current public IP (`/32` means exactly one address) can reach the Kubernetes API. Nobody else on the internet can. |
| `alert_email` | The email address that receives the project's alerts. Use your real email. |
| `node_desired` | Number of worker nodes. `1` is the cheapest choice for development. |

`terraform init -backend-config=backend.hcl` connects to the remote state from Step 4. `terraform plan -out tfplan` shows what will be created and saves that plan, and `terraform apply tfplan` builds exactly that plan. Read the plan before applying. EKS can take 10 to 15 minutes to create.

## Step 6: Connect to the cluster

```powershell
terraform output -raw kubeconfig_command | Invoke-Expression
kubectl get nodes
```

*Why:* the output `kubeconfig_command` is the `aws eks update-kubeconfig ...` command for your new cluster. Running it sets up kubectl. `kubectl get nodes` should list your node with status `Ready`.

If kubectl cannot connect later, your public IP has probably changed (home Wi-Fi, mobile hotspot). Run the `$ip = ...` block from Step 5 again and `terraform apply` to update `api_allowed_cidrs`.

## Step 7: Destroy when finished

```powershell
terraform destroy
```

*Why:* this deletes everything the dev environment created so AWS stops charging you. You can rebuild it any time with Step 5. Do not destroy the bootstrap stack while the dev environment still exists, because it holds the state storage.

## Safety

- Read `terraform plan` before every `apply`.
- Never commit `backend.hcl`, `terraform.tfvars`, `*.tfstate`, `tfplan`, `.terraform/` or any access key.
- The app's IAM role is read-only for cost data. Nothing in CostPilot can change AWS directly: changes only happen through a reviewed pull request and ArgoCD.

## Week 4 notes

- Week 4 does not change the app code or the Docker Compose setup. The app still runs locally exactly as before.
- Terraform only touches your AWS account when you run `terraform apply`.

---

# Week 5: Helm and ArgoCD on EKS, daily scan CronJob

**Goal:** run CostPilot on the EKS cluster from Week 4 using GitOps. The app is packaged as a Helm chart, its images live in ECR, and ArgoCD keeps the cluster in sync with what is in Git. A CronJob runs the waste scan every day.

## What was added

- **Helm chart** (`costpilot-gitops/charts/costpilot`) with templates for the backend API, the frontend, an in-cluster MongoDB, service accounts and the daily scan CronJob.
- **Per-environment values** in `costpilot-gitops/envs/dev`, `staging` and `prod`. Dev is the one deployed. Each file overrides the chart defaults (image registry and tag, IAM roles, cost source).
- **ArgoCD application** (`costpilot-gitops/apps/costpilot-dev.yaml`) that points at the chart and the dev values file. It syncs automatically, prunes resources removed from Git, heals manual changes and creates the `costpilot` namespace.
- **Image push script** (`scripts/push-images.ps1`) that builds the backend and frontend images and pushes them to ECR with a unique time-based tag. ECR refuses to overwrite a tag, so every push needs a new one.
- **Daily scan job** (`backend/src/jobs/`) run by a Kubernetes CronJob at 02:00 UTC. It reuses the backend image and the same scanners as the API. Includes tests (`backend/src/tests/scanJob.test.js`).
- **IAM roles for service accounts (IRSA).** The API and the scan job each get their own read-only AWS role from Terraform, so no AWS keys are stored in the cluster.
- **Safe defaults:** `costSource: mock` (sample data) so the first deploy needs no AWS billing access, a throwaway MongoDB inside the cluster, and a ClusterIP frontend service (no public load balancer, so no extra cost).

## How it fits together

```
You push to GitHub  ->  ArgoCD sees the change  ->  renders the Helm chart + envs/dev/values.yaml
                                                      -> creates / updates pods in namespace "costpilot"

scripts/push-images.ps1  ->  ECR (costpilot/backend, costpilot/frontend)  <-  pods pull images from here
```

ArgoCD reads only what is on GitHub. A change that is not committed and pushed never reaches the cluster.

## Week 5 files

```
costpilot-gitops/apps/costpilot-dev.yaml            ArgoCD Application for dev
costpilot-gitops/charts/costpilot/Chart.yaml        chart metadata
costpilot-gitops/charts/costpilot/values.yaml       chart defaults
costpilot-gitops/charts/costpilot/templates/        backend, frontend, mongo, scan-cronjob,
                                                    serviceaccounts, _helpers.tpl, NOTES.txt
costpilot-gitops/envs/dev/values.yaml               dev settings: image registry + tag, IAM roles
costpilot-gitops/envs/staging/values.yaml           staging settings (not deployed yet)
costpilot-gitops/envs/prod/values.yaml              prod settings (not deployed yet)
backend/src/jobs/                                   daily scan job
backend/src/tests/scanJob.test.js                   scan job tests
scripts/push-images.ps1                             build and push images to ECR
docs/week5.md                                       Week 5 notes
```

## Before you start

Week 4 must be finished: the EKS cluster is running and `kubectl get nodes` shows a `Ready` node. ArgoCD must be installed on the cluster, and the ECR repositories (`costpilot/backend`, `costpilot/frontend`) must exist. Run commands from the project root.

## Step 1: Push the images to ECR

Docker Desktop must be running.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-images.ps1
```

The script logs in to ECR, builds both images and pushes them. At the end it prints the `registry` and `tag` to use in the next step.

*Why:* the cluster pulls images from ECR, not from your laptop. The login uses `cmd /c` for the pipe, because the PowerShell pipe adds characters to the password and ECR answers `400 Bad Request`.

## Step 2: Set the image in the dev values

Edit `costpilot-gitops/envs/dev/values.yaml`:

```yaml
image:
  registry: "<account-id>.dkr.ecr.ap-south-1.amazonaws.com"
  tag: <tag printed by push-images.ps1>
```

*Why:* this file is what ArgoCD deploys. Use the same tag for the backend and the frontend, and a new tag after every code change.

## Step 3: Create the secret

The chart reads its settings from a secret that is never stored in Git:

```powershell
kubectl create namespace costpilot
$jwt = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
kubectl -n costpilot create secret generic costpilot-secrets `
  --from-literal=JWT_SECRET=$jwt `
  --from-literal=MONGO_URI="mongodb://mongo:27017/costpilot"
```

Add `--from-literal=ANTHROPIC_API_KEY=...` only if you want real Claude answers.

*Why:* without this secret the pods stop with `CreateContainerConfigError`. `mongo` is the Service name of the MongoDB in the cluster. If the namespace already exists, skip the first line.

## Step 4: Commit and push

```powershell
git add -A
git status --short
git commit -m "Set dev image tag"
git push origin main
```

Check `git status --short` before committing: no `.env`, `terraform.tfvars`, `backend.hcl`, `tfplan` or `*.tfstate` should be in the list.

## Step 5: Deploy with ArgoCD

If the application is not created yet:

```powershell
kubectl apply -f costpilot-gitops\apps\costpilot-dev.yaml
```

Then ask ArgoCD to refresh and check:

```powershell
kubectl -n argocd annotate application costpilot-dev argocd.argoproj.io/refresh=hard --overwrite
kubectl -n argocd get applications
kubectl -n costpilot get pods
```

Expected result after one or two minutes:

```
NAME            SYNC STATUS   HEALTH STATUS
costpilot-dev   Synced        Healthy

NAME                        READY   STATUS
backend-...                 1/1     Running
frontend-...                1/1     Running
mongo-...                   1/1     Running
```

*Why:* **Synced** means the cluster matches Git. **Progressing** means pods are starting and not ready yet, which is normal for a minute or two. **Healthy** means every pod is ready.

## Step 6: Open the app

```powershell
kubectl -n costpilot port-forward svc/frontend 8081:80
```

Open http://localhost:8081, create an account and sign in. Stop with Ctrl + C.

## Step 7: Check the daily scan job

```powershell
kubectl -n costpilot get cronjob
kubectl -n costpilot create job --from=cronjob/<cronjob-name> scan-test
kubectl -n costpilot logs job/scan-test
```

*Why:* the CronJob runs at 02:00 UTC every day. The second command starts one run now so you do not have to wait. Get `<cronjob-name>` from the first command. Delete the test run with `kubectl -n costpilot delete job scan-test`.

## Updating the app

1. Change the code.
2. Run `scripts\push-images.ps1` and copy the new tag.
3. Put the new tag in `costpilot-gitops/envs/dev/values.yaml`.
4. `git add -A`, `git commit`, `git push origin main`.
5. ArgoCD picks it up automatically, or run the refresh command from Step 5.

## Useful commands

| Command | What it does |
|---|---|
| `kubectl -n argocd get applications` | Sync and health of the app |
| `kubectl -n argocd get application costpilot-dev -o jsonpath="{.status.conditions}"` | The exact error when Sync is `Unknown` |
| `kubectl -n argocd describe application costpilot-dev` | Path, repo, branch and events |
| `kubectl -n costpilot get pods -w` | Watch pods start (Ctrl + C to stop) |
| `kubectl -n costpilot logs deploy/backend --tail 30` | Last backend log lines |
| `kubectl -n costpilot describe pod <pod-name>` | Events that explain pull and start errors |
| `kubectl -n costpilot get deploy <name> -o jsonpath="{.spec.template.spec.containers[0].image}"` | The image a deployment really uses |

## Safety

- ArgoCD only reads GitHub, so every change goes through a commit. Nothing is changed by hand in the cluster, and `selfHeal` reverts manual edits.
- Secrets are created by hand and never stored in Git.
- The pods use IAM roles with read-only permissions, not access keys.
- The dev MongoDB is a throwaway: its data is lost when the pod restarts. For data you care about, turn it off in the values file and use MongoDB Atlas in the secret's `MONGO_URI`.
- The cluster costs money while it runs. Run `terraform destroy` (Week 4, Step 7) when you finish for the day.

---

# Running the project

## Services and URLs

| Service | Port | URL | Notes |
|---|---|---|---|
| Frontend (React, nginx) | 8080 | http://localhost:8080 | The app you open in the browser |
| Frontend dev server (Vite) | 5173 | http://localhost:5173 | Only when running without Docker |
| Backend (Express API) | 5000 | http://localhost:5000 | Health check: http://localhost:5000/health |
| MongoDB | 27017 | `mongodb://localhost:27017/costpilot` | See the Database section for Docker |
| Claude API | 443 | https://api.anthropic.com | Called by the backend only, and only when a key is set |

```
Browser -> Frontend :8080 (nginx) -> /api/* proxied to Backend :5000 -> MongoDB :27017
                                                                     -> Claude API (optional)
```

In Docker, containers reach each other by service name (`backend`, `mongo`), so the backend uses `mongodb://mongo:27017/costpilot`. From your own machine, use `localhost`.

## Run with Docker (recommended)

Requires Docker Desktop.

```powershell
copy .env.example .env        # macOS/Linux: cp .env.example .env
docker compose up -d --build
docker compose ps             # frontend, backend and mongo should all be Up
```

Open http://localhost:8080, choose **Create an account** (password 8+ characters) and sign in. Sample data and sample AI answers are used by default, so no AWS account or API key is needed.

```powershell
docker compose logs backend --tail 30   # backend errors
docker compose down                     # stop, keeps database data
docker compose down -v                  # stop and delete database data
docker compose up -d --build frontend   # rebuild one service after a code change
```

## Run without Docker (for development)

Needs Node.js 20+ and MongoDB.

**1. Database**

```powershell
docker run -d --name costpilot-mongo -p 27017:27017 mongo:7
```

**2. Backend**: create `backend/.env`:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/costpilot
JWT_SECRET=change-me-to-a-long-random-string
COST_SOURCE=mock
ANTHROPIC_API_KEY=
```

```powershell
cd backend
npm install
npm run dev      # expect "MongoDB connected" and "API listening on :5000 (cost source: mock, ai: mock)"
```

**3. Frontend** (second terminal):

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173
```

The Vite dev server does not forward `/api` by default. Add this to `frontend/vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:5000' } },
})
```

## Database

MongoDB 7, database name `costpilot`.

| Collection | Purpose | Added in |
|---|---|---|
| `users` | Accounts (email, bcrypt hash, role) | Week 1 |
| `recommendations` | Scan findings with savings estimate, status and AI ranking | Week 2, extended in Week 3 |
| `costcaches` | Cached Cost Explorer responses | Week 2 |
| `aiusages` | AI calls and tokens per user per day | Week 3 |
| `aicaches` | Saved explanations, expire after 7 days | Week 3 |
| `chatmessages` | Ask AI chat history per user | Week 3 |

| Where you run | Connection string |
|---|---|
| Backend in Docker Compose | `mongodb://mongo:27017/costpilot` |
| Backend on your machine | `mongodb://localhost:27017/costpilot` |

Docker Compose does not publish port 27017. To connect with MongoDB Compass, add `ports: ["27017:27017"]` to the `mongo` service, run `docker compose up -d`, then connect to `mongodb://localhost:27017/costpilot`.

Inspect data without extra tools:

```powershell
docker compose exec mongo mongosh costpilot
```
```js
show collections
db.users.find({}, { email: 1, role: 1 })
db.recommendations.countDocuments()
db.aiusages.find()
```

Data lives in the `mongo-data` Docker volume and survives `docker compose down`.

## Configuration

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | dev value | Long random string used to sign login tokens. Change it. |
| `MONGO_URI` | `mongodb://mongo:27017/costpilot` | MongoDB connection string |
| `COST_SOURCE` | `mock` | `mock` for sample data, `aws` for real data |
| `CACHE_HOURS` | `24` | How long to cache Cost Explorer results |
| `AWS_REGION` | `ap-south-1` | Region for resource scans |
| `AWS_ACCESS_KEY_ID` | empty | Only needed when `COST_SOURCE=aws` |
| `AWS_SECRET_ACCESS_KEY` | empty | Only needed when `COST_SOURCE=aws` |
| `ANTHROPIC_API_KEY` | empty | Empty = free sample AI answers. Set it to use Claude. |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Claude model used for AI features |
| `AI_MODE` | not set | Set to `mock` to force sample answers even when a key is set |
| `AI_DAILY_LIMIT` | `30` | Max AI requests per user per day |
| `AI_PRICE_INPUT_PER_MTOK` | empty | USD per million input tokens, from the Anthropic pricing page |
| `AI_PRICE_OUTPUT_PER_MTOK` | empty | USD per million output tokens. Set both prices to see an estimated daily cost |

## Tests

```powershell
cd backend
npm test        # anomaly, Cost Explorer, scanners and AI tests
```

With the containers running, check the API end to end:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1         # Weeks 1 and 2
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-week3.ps1   # Week 3 (AI)
```

For Terraform, check the code without creating anything:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tf-validate.ps1
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `no configuration file provided: not found` | Run the command from the project root, where `docker-compose.yml` lives |
| Backend keeps restarting | `docker compose logs backend`. File names are case sensitive in Linux containers (`ec2Idle.js`, not `ec2idle.js`) |
| "Request failed." on every tab | Backend is down or you are not signed in. Check `docker compose ps` |
| Sent back to sign-in | Token expired or from an older version. Clear site data and register again |
| Code change not visible | The frontend is built into the image. Rebuild it and hard refresh (Ctrl + F5) |
| Top button does nothing | The page is too short to scroll. Try Overview or Calendar |
| "The Claude API key was rejected" | Check `ANTHROPIC_API_KEY` in `.env`, then `docker compose up -d --build backend` |
| "Claude could not run this request" | `ANTHROPIC_MODEL` is not a valid model name |
| "Claude is rate limiting requests" | Wait a minute and try again |
| "You have used all 30 AI requests" | Wait for midnight UTC or raise `AI_DAILY_LIMIT` |
| "There is nothing to rank yet" | Run **Scan now** on the Savings tab first |
| AI answers say "sample" | No API key is set. Add `ANTHROPIC_API_KEY` to use Claude |
| `.env` change not picked up | Recreate the backend: `docker compose up -d --build backend` |
| `terraform` or `aws` is not recognized | Close PowerShell and open it again after `winget install` |
| `No valid credential sources found` | Run `aws configure` again, then `aws sts get-caller-identity` |
| `terraform init` asks for backend settings or fails | Run it from `terraform\envs\dev` with `-backend-config=backend.hcl`, and check that `backend.hcl` exists |
| `backend.hcl` looks broken | Recreate it with `Out-File -Encoding ascii` as in Step 4 |
| `UnauthorizedOperation` on apply | The AWS user is missing a permission. Read the error for the action name and add it |
| `kubectl get nodes` times out | Your public IP changed. Update `api_allowed_cidrs` in `terraform.tfvars` and apply again |
| Nodes show `NotReady` | Wait a few minutes after apply, then check again |
| S3 bucket name already exists | Bucket names are global. Change the name variable and apply again |
| `terraform destroy` hangs on the VPC | Delete leftover load balancers or network interfaces created by Kubernetes, then retry |
| ECR login `400 Bad Request` | PowerShell's pipe corrupts the password. Use `cmd /c "aws ecr get-login-password ... \| docker login ..."` as in `push-images.ps1` |
| `argument --region: expected one argument` | Script variables like `$Region` were pasted into the terminal. Run the `.ps1` file instead |
| `timeout awaiting response headers` on `docker push` | Network timeout. Run `docker push` again, finished layers are skipped |
| ArgoCD `app path does not exist`, Sync `Unknown` | The chart is not on GitHub or the path is wrong. Commit and push `costpilot-gitops/`, and use path `costpilot-gitops/charts/costpilot` |
| Pods `InvalidImageName` | Image registry or tag is empty or still a placeholder. Fix `envs/dev/values.yaml`, then push |
| Pods `ImagePullBackOff` | Wrong repo name or tag, or the node role lacks `AmazonEC2ContainerRegistryReadOnly`. Run `kubectl describe pod` |
| Pods `CreateContainerConfigError` | The `costpilot-secrets` secret is missing. Create it as in Week 5, Step 3 |
| Health stays `Progressing` | Pods are not ready yet. Wait, then check `kubectl -n costpilot logs deploy/backend` |
| `kubectl` times out | Your public IP changed. Update `api_allowed_cidrs` and run `terraform apply` |
| `tfplan` shows in `git status` | `git rm --cached terraform/envs/dev/tfplan` and add `tfplan` to `.gitignore` |

## Project structure

```
backend/          Express API, scanners, AI service, anomaly detection, daily scan job (src/jobs), tests
frontend/         React + Vite app, served by nginx in Docker
costpilot-gitops/ Helm chart (charts/costpilot), ArgoCD apps and per-environment values (Week 5)
docs/             Architecture notes, IAM policy, weekly notes (week2.md to week5.md)
scripts/          Smoke tests (Weeks 2 and 3), tf-validate.ps1 (Week 4), push-images.ps1 (Week 5)
terraform/        Infrastructure code: bootstrap/ (remote state) and envs/dev/ (Week 4)
```