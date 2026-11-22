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

## Project structure

```
backend/          Express API, scanners, AI service, anomaly detection, tests
frontend/         React + Vite app, served by nginx in Docker
costpilot-gitops/ Helm chart and Argo CD ApplicationSet
docs/             Architecture notes, IAM policy, weekly notes (week2.md, week3.md)
scripts/          PowerShell smoke tests (Week 2 and Week 3)
terraform/        Infrastructure code (Week 4)
worker/           Scheduled scan worker (Week 5)
```