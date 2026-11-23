# Checks the Terraform code WITHOUT touching AWS. Needs Terraform installed and an internet connection
# (it downloads the provider plugins). Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\tf-validate.ps1
$failed = 0

Write-Host "== terraform fmt"
terraform fmt -check -recursive terraform
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL  formatting. Run: terraform fmt -recursive terraform" -ForegroundColor Red
  $failed++
} else {
  Write-Host "PASS  formatting" -ForegroundColor Green
}

foreach ($dir in "terraform/bootstrap", "terraform/envs/dev", "terraform/envs/prod") {
  Write-Host "== $dir"
  Push-Location $dir
  terraform init -backend=false -input=false | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL  init in $dir" -ForegroundColor Red
    $failed++
  } else {
    terraform validate
    if ($LASTEXITCODE -ne 0) {
      Write-Host "FAIL  validate in $dir" -ForegroundColor Red
      $failed++
    } else {
      Write-Host "PASS  $dir" -ForegroundColor Green
    }
  }
  Pop-Location
}

Write-Host ""
if ($failed -eq 0) { Write-Host "All Terraform checks passed." -ForegroundColor Green }
else { Write-Host "$failed check(s) failed." -ForegroundColor Red; exit 1 }