# Creates the CostPilot dashboard and monitors in Datadog through its API.
# Needs the keys in $env:DD_API_KEY and $env:DD_APP_KEY (read them from Secrets Manager or type them in).
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\scripts\datadog-setup.ps1 -Site datadoghq.com
param([string]$Site = "datadoghq.com")
$ErrorActionPreference = "Stop"
if (-not $env:DD_API_KEY -or -not $env:DD_APP_KEY) { throw "Set DD_API_KEY and DD_APP_KEY first." }

$headers = @{ "DD-API-KEY" = $env:DD_API_KEY; "DD-APPLICATION-KEY" = $env:DD_APP_KEY; "Content-Type" = "application/json" }
$base = "https://api.$Site/api/v1"

$dash = Get-Content -Raw "gitops/platform/datadog/dashboards/costpilot-overview.json"
$r = Invoke-RestMethod -Method Post -Uri "$base/dashboard" -Headers $headers -Body $dash
Write-Host "Dashboard created: https://app.$Site/dashboard/$($r.id)" -ForegroundColor Green

foreach ($file in Get-ChildItem "gitops/platform/datadog/monitors/*.json") {
  $m = Invoke-RestMethod -Method Post -Uri "$base/monitor" -Headers $headers -Body (Get-Content -Raw $file.FullName)
  Write-Host "Monitor created: $($m.name) (id $($m.id))"
}
Write-Host "Done. Edit the email address in the monitors in Datadog if you want alerts sent to you." -ForegroundColor Yellow
