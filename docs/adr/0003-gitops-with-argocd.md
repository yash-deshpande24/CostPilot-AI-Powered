# ADR 0003: GitOps with ArgoCD

Status: accepted

## Context
Deployments should be auditable, reversible, and never done by hand with `kubectl apply`.

## Decision
Git is the source of truth. ArgoCD watches `gitops/` on `main` and makes the cluster match it. Self-heal reverts manual changes, and prune removes what Git no longer lists.

## Consequences
- Every change is a commit: who changed what, when, and how to undo it with `git revert`.
- Drift is corrected automatically.
- A bad commit is visible in the ArgoCD UI, and the smoke test marks the sync as failed.

## Alternatives
- `helm upgrade` from CI: works, but the cluster state is then only known to the CI log.
- Flux: similar model, but ArgoCD's UI made it easier to demonstrate.
