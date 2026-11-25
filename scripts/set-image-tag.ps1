<#
.SYNOPSIS
  Changes image.tag in costpilot-gitops/envs/<env>/values.yaml. That is how a build is promoted.

.DESCRIPTION
  Only the "tag:" line inside the top-level "image:" block is touched. Comments and every other
  setting stay exactly as they are. The tag is checked against the Docker tag rules first, so a
  value like "$(whoami)" or "a;rm -rf" can never reach Git or a shell.

.EXAMPLE
  .\scripts\set-image-tag.ps1 -Tag sha-1a2b3c4 -Env dev

.EXAMPLE
  .\scripts\set-image-tag.ps1 -Tag 20261125-101500-1a2b3c4 -Env prod -ValuesFile .\costpilot-gitops\envs\prod\values.yaml
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Tag,

  [ValidateSet('dev', 'staging', 'prod')]
  [string]$Env = 'dev',

  [string]$ValuesFile
)

$ErrorActionPreference = 'Stop'

# Docker tag rules: up to 128 characters, letters, digits, dot, underscore, dash.
if ($Tag -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
  throw "Tag '$Tag' is not a valid Docker tag. Use letters, digits, dot, underscore or dash (max 128 characters)."
}

if (-not $ValuesFile) {
  $ValuesFile = Join-Path $PSScriptRoot "..\costpilot-gitops\envs\$Env\values.yaml"
}
$ValuesFile = [IO.Path]::GetFullPath($ValuesFile)
if (-not (Test-Path -LiteralPath $ValuesFile)) {
  throw "Values file not found: $ValuesFile"
}

$lines = [IO.File]::ReadAllLines($ValuesFile)

# Find the top-level "image:" block.
$imageIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^image:\s*$') { $imageIndex = $i; break }
}
if ($imageIndex -lt 0) { throw "No top-level 'image:' block in $ValuesFile" }

# The tag line is the first "tag:" inside that block.
$tagIndex = -1
for ($i = $imageIndex + 1; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^\S') { break } # left the block
  if ($lines[$i] -match '^(?<indent>\s*)tag:\s*(?<value>"?[^"#\r\n]*"?)(?<rest>\s*#.*)?$') {
    $tagIndex = $i
    break
  }
}
if ($tagIndex -lt 0) { throw "No 'tag:' line inside the image: block in $ValuesFile" }

$match = [regex]::Match($lines[$tagIndex], '^(?<indent>\s*)tag:\s*(?<value>"?[^"#\r\n]*"?)(?<rest>\s*#.*)?$')
$indent = $match.Groups['indent'].Value
$comment = $match.Groups['rest'].Value.Trim()
$suffix = if ($comment) { " $comment" } else { '' }

$before = $lines[$tagIndex].TrimEnd()
$lines[$tagIndex] = "$indent" + "tag: $Tag" + $suffix

[IO.File]::WriteAllLines($ValuesFile, $lines, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Updated $ValuesFile"
Write-Host "  before: $before"
Write-Host "  after:  $($lines[$tagIndex].TrimEnd())"
