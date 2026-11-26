# Runbook: the daily scan job failed

The scan runs every day at 02:00 UTC as the `costpilot-scan` CronJob. It prints one JSON line per run with `"event":"scan_job"`.

## 1. Look at the last run
```bash
kubectl -n costpilot get jobs -l app.kubernetes.io/name=scan
kubectl -n costpilot logs job/<latest-job-name>
```

## 2. Read the result
- `event: scan_job` with `failedScanners: []` means it worked.
- `failedScanners` lists the scanners that failed (for example `ebs`). The others still ran.
- `event: scan_job_failed` means the job could not start: usually the database is unreachable.

## 3. Common causes
| Message | Cause | Fix |
|---|---|---|
| `AccessDenied` on EC2 or CloudWatch | The worker IRSA role lacks the read-only policy | Check `docs/iam-policy.json` is attached (Terraform `modules/iam`) |
| `connect ECONNREFUSED` for MongoDB | The database pod is down | `kubectl -n costpilot get pods` |
| `Every scanner failed` | Credentials or region are wrong | Check `AWS_REGION` in values |

## 4. Run it now
```bash
kubectl -n costpilot create job --from=cronjob/costpilot-scan scan-now
kubectl -n costpilot logs job/scan-now
```
