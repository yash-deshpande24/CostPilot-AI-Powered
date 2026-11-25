# End-to-end check of the Week 6 pull request API. Run with the containers up:
#   powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-week6.ps1
param([string]$Base = "http://localhost:5000")
$ErrorActionPreference = "Stop"

$email = "smoke6-$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
$pass = "SmokeTest-12345"
$body = @{ email = $email; password = $pass } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$Base/api/auth/register" -ContentType "application/json" -Body $body | Out-Null
$login = Invoke-RestMethod -Method Post -Uri "$Base/api/auth/login" -ContentType "application/json" -Body $body
$h = @{ Authorization = "Bearer $($login.token)" }
Write-Host "OK  signed in as $email"

$status = Invoke-RestMethod -Uri "$Base/api/prs/status" -Headers $h
Write-Host "OK  PR mode: $($status.mode), used today: $($status.usedToday)/$($status.dailyLimit)"

Invoke-RestMethod -Method Post -Uri "$Base/api/scan" -Headers $h | Out-Null
$recs = Invoke-RestMethod -Uri "$Base/api/recommendations" -Headers $h
$list = if ($recs.recommendations) { $recs.recommendations } else { $recs }
if (-not $list -or $list.Count -eq 0) { throw "No recommendations found after the scan" }
$first = $list[0]
$id = if ($first._id) { $first._id } else { $first.id }
Write-Host "OK  found $($list.Count) findings, using $id"

$pr = Invoke-RestMethod -Method Post -Uri "$Base/api/recommendations/$id/pr" -Headers $h
Write-Host "OK  PR created: mode=$($pr.pr.mode) title=$($pr.pr.title)"

try {
  Invoke-RestMethod -Method Post -Uri "$Base/api/recommendations/$id/pr" -Headers $h | Out-Null
  throw "Second request should have been refused"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 409) { throw }
  Write-Host "OK  second request refused with 409 (already open)"
}

$all = Invoke-RestMethod -Uri "$Base/api/prs" -Headers $h
Write-Host "OK  /api/prs lists $($all.prs.Count) pull request(s)"
Write-Host "`nWeek 6 smoke test passed." -ForegroundColor Green
