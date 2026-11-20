# CostPilot – AI-Powered FinOps Platform for AWS Cost Optimization

Starter monorepo for a React frontend, Node.js API, SQS worker, Terraform infrastructure,
and CI pipelines. This is a development scaffold: connect and validate your AWS account,
database, LLM provider, and deployment environments before production use.

## Prerequisites
- Node.js 22 LTS (or another supported LTS)
- Docker Desktop + Docker Compose
- Terraform 1.8+
- AWS CLI v2 (only for AWS integration)
- kubectl and Helm (for EKS deployment)

## Local development
1. Copy `backend/.env.example` to `backend/.env` and set values.
2. From this directory run `docker compose up --build`.
3. Frontend: http://localhost:8080
4. API health: http://localhost:3000/health

The API currently exposes health, costs, recommendations, and chat starter routes.
AWS Cost Explorer calls require credentials/role permissions and are intentionally not
executed until configured. Never commit `.env` files or AWS credentials.

## Repositories
- `costpilot/`: application source and Terraform.
- `costpilot-gitops/`: Helm chart and Argo CD deployment configuration.

## Important
This scaffold is not a complete audited FinOps product. Add tests, threat modelling,
least-privilege IAM, database migrations, observability, and environment-specific
validation before production.
