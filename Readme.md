# CostPilot

**AI-powered FinOps platform for AWS cost optimization.**
CostPilot finds wasted AWS spend, explains it in plain English with AI, and opens a pull request on your Terraform/GitOps repo to fix it. After a human approves, ArgoCD applies the change.

**Stack:** React, Node.js/Express, MongoDB, AWS (EKS, ECR, S3, SQS, Cost Explorer), Docker, Kubernetes, Terraform, GitHub Actions, Jenkins, ArgoCD (GitOps), Datadog, Claude API.

## Progress

| Week | Focus | Status |
|---|---|---|
| 1 | Login, mock cost dashboard, spike detection, Docker Compose | Done |
| 2 | AWS Cost Explorer, waste scanners, savings recommendations, new UI | Done |
| 3 | Claude API (explain spikes, chat with your bill) | Planned |
| 4 | Terraform (VPC, EKS, ECR, S3, SQS, IAM) | Planned |
| 5 | Helm + ArgoCD on EKS, daily scan CronJob | Planned |
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

# Running the project

## Services and URLs

| Service | Port | URL | Notes |
|---|---|---|---|
| Frontend (React, nginx) | 8080 | http://localhost:8080 | The app you open in the browser |
| Frontend dev server (Vite) | 5173 | http://localhost:5173 | Only when running without Docker |
| Backend (Express API) | 5000 | http://localhost:5000 | Health check: http://localhost:5000/health |
| MongoDB | 27017 | `mongodb://localhost:27017/costpilot` | See the Database section for Docker |

```
Browser -> Frontend :8080 (nginx) -> /api/* proxied to Backend :5000 -> MongoDB :27017
```

In Docker, containers reach each other by service name (`backend`, `mongo`), so the backend uses `mongodb://mongo:27017/costpilot`. From your own machine, use `localhost`.

## Run with Docker (recommended)

Requires Docker Desktop.

```powershell
copy .env.example .env        # macOS/Linux: cp .env.example .env
docker compose up -d --build
docker compose ps             # frontend, backend and mongo should all be Up
```

Open http://localhost:8080, choose **Create an account** (password 8+ characters) and sign in. Sample data is used by default, so no AWS account is needed.

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
```

```powershell
cd backend
npm install
npm run dev      # expect "MongoDB connected" and "API listening on :5000"
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
| `recommendations` | Scan findings with savings estimate and status | Week 2 |
| `costcaches` | Cached Cost Explorer responses | Week 2 |

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
```

Data lives in the `mongo-data` Docker volume and survives `docker compose down`.

## Configuration

Copy `.env.example` to `.env`.

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | dev value | Long random string used to sign login tokens. Change it. |
| `MONGO_URI` | `mongodb://mongo:27017/costpilot` | MongoDB connection string |
| `COST_SOURCE` | `mock` | `mock` for sample data, `aws` for real data |
| `CACHE_HOURS` | `24` | How long to cache Cost Explorer results |
| `AWS_REGION` | `ap-south-1` | Region for resource scans |
| `AWS_ACCESS_KEY_ID` | empty | Only needed when `COST_SOURCE=aws` |
| `AWS_SECRET_ACCESS_KEY` | empty | Only needed when `COST_SOURCE=aws` |
| `ANTHROPIC_API_KEY` | empty | Used from Week 3 |

## Tests

```powershell
cd backend
npm test
```

With the containers running, check the API end to end:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
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

## Project structure

```
backend/          Express API, scanners, anomaly detection, tests
frontend/         React + Vite app, served by nginx in Docker
costpilot-gitops/ Helm chart and Argo CD ApplicationSet
docs/             Architecture notes, IAM policy, weekly notes
scripts/          PowerShell smoke test
terraform/        Infrastructure code (Week 4)
worker/           Scheduled scan worker (Week 5)
```