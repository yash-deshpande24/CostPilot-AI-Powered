# Week 2: real AWS data and waste scanners

## What was added
- `COST_SOURCE=mock|aws` switch. Mock uses sample data and fake AWS resources. AWS uses Cost Explorer and read-only scans.
- Three scanners: unattached EBS volumes, unused Elastic IPs, idle EC2 instances (CPU under 5% average, under 20% peak, over 14 days).
- Recommendations stored in MongoDB with a monthly savings estimate and a status.
- Cost Explorer results cached in MongoDB (`CACHE_HOURS`, default 24) because each API call costs about $0.01.
- Dashboard: "Savings found" panel, "Scan now" button, Sample data / Live AWS data label.

## API
| Method | Path | Description |
|---|---|---|
| GET | /api/costs?days=30 | Daily spend, now from mock or AWS |
| POST | /api/scan | Run all scanners and save findings |
| GET | /api/recommendations | Active findings, biggest savings first |
| PATCH | /api/recommendations/:id | Body `{"status":"dismissed"}` or `{"status":"new"}` |

## Switching to real AWS
1. In AWS IAM, create a user with the policy in `docs/iam-policy.json` (read-only). Create an access key.
2. In Billing, open Cost Explorer once so AWS enables it (data can take up to 24 hours to appear).
3. In `.env` set `COST_SOURCE=aws`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
4. `docker compose up -d --build`
5. Never commit `.env`.

Estimates are rough: EBS uses a per-GB rate by volume type, an idle Elastic IP is about $3.65 a month, and EC2 uses a small on-demand price table. The UI labels them as estimates.
