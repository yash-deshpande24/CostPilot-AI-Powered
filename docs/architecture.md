# CostPilot architecture

```
React (nginx) -> API (Express) -> MongoDB
                     |
                     +-> Cost source (mock now, AWS Cost Explorer in Week 2)
                     +-> Claude API (Week 3)
                     +-> GitHub PRs -> ArgoCD (Week 5-6)
```

## Roadmap
- [x] Week 1: React + API + MongoDB in docker-compose, auth, mock cost dashboard
- [ ] Week 2: AWS Cost Explorer, idle resource scanners
- [ ] Week 3: Claude API (explain spikes, chat with your bill)
- [ ] Week 4: Terraform (VPC, EKS, ECR, S3, SQS, IAM)
- [ ] Week 5: Helm + ArgoCD on EKS, daily scan CronJob
- [ ] Week 6: GitHub Actions + Jenkins promotion, PR generation
- [ ] Week 7: Datadog dashboards, External Secrets, Argo Rollouts
- [ ] Week 8: Polish, diagram, demo video
