# Stores the app's secrets in AWS Secrets Manager. Values are typed here and never written to the project.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\scripts\put-secrets.ps1
# Requires: aws configure already done, and the Week 7 Terraform applied.
param([string]$Secret = "costpilot-dev/app", [string]$Region = "ap-south-1")
$ErrorActionPreference = "Stop"

function Read-Plain($prompt, [switch]$Optional) {
  $value = Read-Host $prompt -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
  if (-not $plain -and -not $Optional) { throw "This value is required." }
  return $plain
}

# Generate a strong JWT secret when the user just presses Enter.
$jwt = Read-Plain "JWT secret (press Enter to generate one)" -Optional
if (-not $jwt) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwt = [Convert]::ToBase64String($bytes)
}
$mongo = Read-Plain "MONGO_URI (for the in-cluster database: mongodb://mongo:27017/costpilot)"
$anthropic = Read-Plain "ANTHROPIC_API_KEY (optional, Enter to skip)" -Optional
$github = Read-Plain "GITHUB_TOKEN for Open PR (optional, Enter to skip)" -Optional

$payload = [ordered]@{ JWT_SECRET = $jwt; MONGO_URI = $mongo }
if ($anthropic) { $payload.ANTHROPIC_API_KEY = $anthropic }
if ($github) { $payload.GITHUB_TOKEN = $github }

$tmp = [IO.Path]::GetTempFileName()
try {
  ($payload | ConvertTo-Json -Compress) | Out-File -Encoding ascii -NoNewline $tmp
  aws secretsmanager put-secret-value --secret-id $Secret --secret-string "file://$tmp" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not store the secret. Check the name with: aws secretsmanager list-secrets" }
} finally {
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}
Write-Host "Stored $($payload.Count) keys in $Secret. The values were not printed or saved." -ForegroundColor Green
Write-Host "Next: set secrets.fromAws: true in gitops/envs/dev/values.yaml, then commit and push." -ForegroundColor Yellow
