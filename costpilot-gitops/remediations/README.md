# Remediations

CostPilot's **Open PR** button writes one small YAML file here and opens a pull request.

```
costpilot-gitops/remediations/<kind>-<resource-id>.yaml
```

Example:

```yaml
apiVersion: costpilot.io/v1
kind: Remediation
metadata:
  name: "ebs-vol-0f9e8d7c6b5a40312"
  createdAt: "2026-11-25T10:00:00.000Z"
spec:
  action: delete_unattached_volume
  resourceId: "vol-0f9e8d7c6b5a40312"
  region: "ap-south-1"
  estimatedMonthlySavingsUsd: 40.00
  risk: high
  recommendationId: "..."
```

A person reviews the pull request and merges it. CostPilot has no AWS permissions of its own,
so nothing is deleted or stopped automatically. This folder is a record of what was approved;
wire your own apply step (Terraform, a Lambda, or a manual console change) to it when you want
the fix to run automatically.

This folder is **not** rendered by the Helm chart, so ArgoCD never tries to create these objects
in the cluster.
