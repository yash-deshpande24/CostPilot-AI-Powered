# CostPilot

**AI-powered FinOps platform for AWS cost optimization.**
CostPilot finds wasted AWS spend, explains it in plain English with AI, and opens a pull request on your Terraform/GitOps repo to fix it. After a human approves, ArgoCD applies the change.

**Stack:** React, Node.js/Express, MongoDB, AWS (EKS, ECR, S3, SQS, Cost Explorer), Docker, Kubernetes, Terraform, GitHub Actions, Jenkins, ArgoCD (GitOps), Datadog, Claude API.

## Status
Week 1 of 8: login, mock cost dashboard and spike detection run locally with Docker. See [docs/architecture.md](docs/architecture.md) for the roadmap.

## Run it locally

```bash
cp .env.example .env
docker compose up --build
```

- App: http://localhost:8080
- API health: http://localhost:5000/health

Create an account on the sign-in page. The dashboard uses generated sample data until Week 2.

### Without Docker
```bash
# terminal 1 (needs MongoDB on localhost:27017)
cd backend && npm install && npm run dev
# terminal 2
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## API
| Method | Path | Description |
|---|---|---|
| GET | /health | Liveness check |
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get a JWT |
| GET | /api/auth/me | Current user |
| GET | /api/costs?days=30 | Daily spend, per-service totals, anomalies |
