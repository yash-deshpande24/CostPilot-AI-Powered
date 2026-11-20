# Architecture overview

- Frontend: React SPA served by NGINX.
- API: Express REST API.
- Worker: SQS long-poll consumer for asynchronous scans.
- Data: PostgreSQL (schema and migrations still to be added).
- AWS: Cost Explorer read integration; extend with Organizations and Budgets only with
  explicit cross-account trust and least-privilege policies.
- Infrastructure: Terraform.
- Delivery: GitHub Actions/Jenkins build immutable images; Argo CD reconciles GitOps state.

Start with read-only visibility. Keep remediation approval-based and auditable.
