# Stores the Datadog API key and application key in Secrets Manager (secret costpilot-dev/datadog).
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\scripts\put-datadog-keys.ps1
param([string]$Secret = "costpilot-dev/datadog", [string]$Region = "ap-south-1")
$ErrorActionPreference = "Stop"

function Read-Required($prompt) {
  $value = Read-Host $prompt
  if (-not $value) { throw "This value is required." }
  return $value
}

$payload = [ordered]@{
  "api-key" = (Read-Required "Datadog API key")
  "app-key" = (Read-Required "Datadog application key")
}

$tmp = [IO.Path]::GetTempFileName()
try {
  ($payload | ConvertTo-Json -Compress) | Out-File -Encoding ascii -NoNewline $tmp
  aws secretsmanager put-secret-value --secret-id $Secret --secret-string "file://$tmp" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not store the Datadog keys." }
} finally {
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}
Write-Host "Stored the Datadog keys in $Secret." -ForegroundColor Green