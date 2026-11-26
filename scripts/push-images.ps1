# Builds the backend and frontend images and pushes them to your ECR repositories.
# Run from the project root:   powershell -ExecutionPolicy Bypass -File .\scripts\push-images.ps1
# Docker Desktop must be running, and "aws configure" must already be done.
param(
  [string]$Region = "ap-south-1",
  # ECR refuses to overwrite a tag, so every push needs a new one. The default is the current time.
  [string]$Tag = (Get-Date -Format "yyyyMMdd-HHmmss")
)
$ErrorActionPreference = "Stop"

$account = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) { throw "Could not read your AWS account. Run: aws configure" }
$registry = "$account.dkr.ecr.$Region.amazonaws.com"

aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $registry
if ($LASTEXITCODE -ne 0) { throw "Docker could not log in to ECR" }

foreach ($name in "backend", "frontend") {
  $image = "$registry/costpilot/${name}:$Tag"
  Write-Host "== building $image"
  docker build -t $image "./$name"
  if ($LASTEXITCODE -ne 0) { throw "Build failed for $name" }
  docker push $image
  if ($LASTEXITCODE -ne 0) { throw "Push failed for $name" }
}

Write-Host ""
Write-Host "Done. In gitops/envs/dev/values.yaml set:" -ForegroundColor Green
Write-Host "  registry: $registry"
Write-Host "  tag:      $Tag"
