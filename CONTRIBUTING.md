# Working on CostPilot

## Branches and commits
- Work on a branch, open a pull request into `main`.
- Commits follow Conventional Commits: `feat:`, `fix:`, `docs:`, `ci:`, `chore:`.
- Promotion commits from Jenkins use `chore(dev): promote image <tag> [skip ci]`.

## Before you open a pull request
```bash
cd backend && npm test
cd ../frontend && npm run build
terraform -chdir=terraform/envs/dev fmt -check
helm lint gitops/charts/costpilot -f gitops/envs/dev/values.yaml
```

## Never commit
- `.env`, `terraform.tfvars`, `backend.hcl`, `*.tfstate`, or any secret value.
- Real AWS account IDs in new places. The values file keeps the existing ones only.

## Changing infrastructure
- Change Terraform in `terraform/modules` first, then the environment that uses it.
- Run `plan` and read it before `apply`. A plan that destroys the cluster or the state bucket is a stop sign.

## Changing the app
- Add a test for each new route or service.
- Keep AI output out of commands. Fix runbooks through fixed templates in `backend/src/services/remediation.js`.
