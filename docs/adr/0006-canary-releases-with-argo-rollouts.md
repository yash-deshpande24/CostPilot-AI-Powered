# ADR 0006: Canary releases with Argo Rollouts

Status: accepted

## Context
A bad release should reach a small share of users first, and roll back without a human.

## Decision
The API runs as an Argo Rollout. It sends 50% of pods to the new version, runs a health analysis three times (every 20 seconds), then moves everyone. Two failures in a row roll back.

## Consequences
- A bad release is caught on a canary, not on everyone.
- Rollback happens without a human.
- Canary weight is by pod count, so with one replica the test is coarse. Prod uses two or more replicas.
- The health check tests `/health` only. It does not test error rate. Adding a Datadog-based analysis is the next step.

## Alternatives
- Rolling update only: simpler, but a bad version reaches everyone before anyone notices.
- Service mesh traffic splitting (Istio or Linkerd): precise, but far more to run.
