# Initial security checklist

- Use workload identity (EKS Pod Identity/IRSA); never bake AWS keys into images.
- Store secrets in AWS Secrets Manager and sync via External Secrets.
- Enforce TLS, network policies, pod security context, resource limits and non-root images.
- Validate and rate-limit API inputs; add auth, RBAC, audit trails and tenant isolation.
- Encrypt data at rest and in transit; define retention and deletion policies.
- Treat LLM prompts and model output as untrusted; redact sensitive data.
- Require human approval for resource-changing recommendations.
