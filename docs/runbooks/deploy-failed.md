# Runbook: a deploy or sync failed

## Where it shows
- ArgoCD: `kubectl -n argocd get applications`. A `Degraded`, `OutOfSync` or failed operation means the release did not finish.
- GitHub Actions: the CI run is red.
- Jenkins: the `costpilot-promote` build is red.

## 1. Find the stage
| Stage | Check | Typical fix |
|---|---|---|
| CI red | The failed job's log in Actions | Fix the test, the Dockerfile, or the Trivy finding, then push |
| Jenkins red at "Check input" | The IMAGE_TAG is not valid | Copy the tag exactly from the CI summary |
| Jenkins red at "Promote" | Git push rejected | Check the token has Contents write; check branch protection |
| ArgoCD OutOfSync | `kubectl -n argocd describe application costpilot-dev` | Usually a bad value in `gitops/envs/dev/values.yaml` |
| ArgoCD sync failed on the smoke test | `kubectl -n costpilot logs job/costpilot-smoke` | The new version is not healthy. Roll back (below). |
| Pods `ImagePullBackOff` | `kubectl -n costpilot describe pod <name>` | The tag was never pushed to ECR. Rerun CI. |
| Pods `CreateContainerConfigError` | `kubectl -n costpilot get secret costpilot-secrets` | The secret is missing or ExternalSecret is not synced |

## 2. Roll back
The safest rollback is to promote the previous good tag:
1. In Jenkins, run `costpilot-promote` with ENVIRONMENT `dev` and the older IMAGE_TAG.
2. Watch ArgoCD: `kubectl -n argocd get application costpilot-dev -w`.

For an emergency with no Jenkins access, revert the commit that changed the tag and push:
```bash
git revert <commit-sha>
git push
```
ArgoCD then deploys the reverted tag.

## 3. Confirm
- `kubectl -n costpilot get pods` shows `Running` and `Ready`.
- The smoke test job (`costpilot-smoke`) completed.
