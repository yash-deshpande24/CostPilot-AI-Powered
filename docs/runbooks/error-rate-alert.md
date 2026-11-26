# Runbook: API error rate above 5%

Alert: `CostPilot: API error rate above 5%` (Datadog monitor, dev).

## 1. Confirm
- Open the CostPilot dashboard in Datadog. Is the 5xx rate still high?
- `kubectl -n costpilot get pods`. Are the pods `Running` and `Ready`?

## 2. Check the latest release
- `kubectl -n costpilot get rollout backend` and `kubectl -n costpilot get analysisrun`.
- If a release is in progress or just finished, the new version is the likely cause.

## 3. Check the logs
- `kubectl -n costpilot logs -l app.kubernetes.io/name=backend --tail 100`
- Look for `Cost fetch failed`, `AI call failed` and database errors. The message names the cause.

## 4. Decide
| Finding | Action |
|---|---|
| New release, errors started with it | Roll back: promote the previous good tag in Jenkins (`costpilot-promote`) |
| MongoDB unreachable | Check the in-cluster database: `kubectl -n costpilot get pods -l app.kubernetes.io/name=mongo` |
| AWS permission errors | Check the IRSA role on the backend service account |
| Claude errors only | Not user-facing for most pages. Check the Anthropic status page and `ANTHROPIC_API_KEY`. |

## 5. Close out
- Write down the cause and the time, in the incident notes or the commit that fixed it.
- If the alert was noisy, change the threshold in `gitops/platform/datadog/monitors/` and rerun `datadog-setup.ps1` after deleting the old monitor.
