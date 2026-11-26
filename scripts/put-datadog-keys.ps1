# Stores the Datadog API key and application key in Secrets Manager (secret costpilot-dev/datadog).
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\scripts\put-datadog-keys.ps1
param([string]$Secret = "costpilot-dev/datadog", [string]$Region = "ap-south-1")
$ErrorActionPreference = "Stop"

function Read-Plain($prompt) {
  $v = Read-Host $prompt -AsSecureString
  $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($v))
  if (-not $p) { throw "This value is required." }
  return $p
}
$payload = [ordered]@{ "api-key" = (Read-Plain "Datadog API key"); "app-key" = (Read-Plain "Datadog application key") }
$tmp = [IO.Path]::GetTempFileName()
try {
  ($payload | ConvertTo-Json -Compress) | Out-File -Encoding ascii -NoNewline $tmp
  aws secretsmanager put-secret-value --secret-id $Secret --secret-string "file://$tmp" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not store the Datadog keys." }
} finally {
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}
Write-Host "Stored the Datadog keys in $Secret." -ForegroundColor Green
