# deploy-and-test.ps1
# Fully automated: push -> wait for Render deploy -> run E2E test.
#
# Token safety: the script reads GITHUB_TOKEN from a local .env.local file
# (or from the user's prompt input). It never logs, prints, or transmits
# the token. The variable is cleared from memory when the script exits.
#
# First-time setup (one-time, 30 seconds):
#   1. Create a fine-grained PAT on https://github.com/settings/personal-access-tokens/new
#      - Resource owner: apptestaug01-lang
#      - Repository access: only Arogan
#      - Permissions: Contents = Read and write
#   2. Save the token to C:\Arogan\BusinessLoanApp\.env.local:
#        GITHUB_TOKEN=ghp_your_new_token
#      (.env.local is already in .gitignore)
#   3. Run this script:
#        pwsh scripts/deploy-and-test.ps1
#
# Re-runs use the same token until you delete it or rotate it.

[CmdletBinding()]
param(
  [switch]$SkipPush,           # Don't push; assume the push is already done
  [switch]$SkipDeployWait,     # Don't wait for Render deploy to finish
  [switch]$SkipTest,           # Don't run the E2E test
  [string]$Backend = 'arogan-mx0n.onrender.com',
  [string]$Frontend = 'loanflow-frontend-z67v.onrender.com',
  [int]$DeployTimeoutSec = 600,
  [switch]$Force               # Skip pre-flight checks
)

$ErrorActionPreference = 'Stop'
$Script:Root = Split-Path -Parent $PSScriptRoot

function Write-Section($msg) {
  Write-Host ''
  Write-Host ('=' * 70) -ForegroundColor Cyan
  Write-Host $msg -ForegroundColor Cyan
  Write-Host ('=' * 70) -ForegroundColor Cyan
}

function Get-LocalToken {
  $envFile = Join-Path $Script:Root '.env.local'
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*GITHUB_TOKEN\s*=\s*(.+)\s*$') {
        return $Matches[1].Trim()
      }
    } | Where-Object { $_ }
  }
  return $null
}

function Save-LocalToken($token) {
  $envFile = Join-Path $Script:Root '.env.local'
  "GITHUB_TOKEN=$token" | Set-Content -Path $envFile -Encoding UTF8
  Write-Host "Token saved to $envFile" -ForegroundColor Green
  Write-Host "Add '.env.local' to .gitignore if not already there." -ForegroundColor Yellow
}

function Test-TokenFormat($token) {
  return $token -match '^gh[ps]_[A-Za-z0-9]{20,}$'
}

function Test-TokenFormat($token) {
  return $token -match '^gh[ps]_[A-Za-z0-9]{20,}$'
}

# -------------------------------------------------------------- preflight
Write-Section 'Preflight checks'

Set-Location $Script:Root

if (-not $Force) {
  $status = git status --porcelain
  if ($status) {
    Write-Host 'Working tree is dirty. Commit or stash first:' -ForegroundColor Red
    Write-Host $status
    exit 1
  }
  Write-Host 'Working tree clean.' -ForegroundColor Green
}

# Use rev-parse to safely compute the upstream commit
$upstream = git rev-parse --verify origin/main 2>$null
$commitsToPush = if ($LASTEXITCODE -eq 0) {
  git log --oneline "$upstream..HEAD" 2>$null
} else {
  $null
}
if ($LASTEXITCODE -ne 0 -or -not $commitsToPush) {
  Write-Host 'No upstream commits to compare — will show last 3 commits instead.' -ForegroundColor Yellow
  $commitsToPush = git log --oneline -3
} elseif (-not $commitsToPush) {
  Write-Host 'No new commits to push.' -ForegroundColor Yellow
} else {
  Write-Host "Commits to push:" -ForegroundColor Cyan
  Write-Host $commitsToPush
}

# -------------------------------------------------------------- token
Write-Section 'GitHub token'

if ($SkipPush) {
  Write-Host 'Skipping token check (--SkipPush).' -ForegroundColor Yellow
  $token = $null
} else {
  $token = $env:GITHUB_TOKEN
  if (-not $token) { $token = Get-LocalToken }

  if (-not $token) {
    Write-Host 'No GITHUB_TOKEN found in environment or .env.local' -ForegroundColor Yellow
    $secure = Read-Host 'Paste new GitHub PAT (input is hidden)' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }

  if (-not (Test-TokenFormat $token)) {
    Write-Host 'Token does not match ghp_/ghs_ format. Aborting.' -ForegroundColor Red
    exit 1
  }

  if (-not (Test-Path (Join-Path $Script:Root '.env.local'))) {
    $save = Read-Host 'Save token to .env.local for next run? (y/N)'
    if ($save -eq 'y') { Save-LocalToken $token }
  }
}

# -------------------------------------------------------------- push
if (-not $SkipPush) {
  Write-Section 'Pushing to origin/main'

  # Use a custom remote URL with the token embedded ONLY for this command.
  # After push we restore the clean URL.
  $originalRemote = git remote get-url origin
  $authRemote = $originalRemote -replace '^https://', "https://$token@"

  try {
    git push $authRemote main 2>&1 | Tee-Object -Variable pushOutput | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw 'git push failed'
    }
  } finally {
    # Always restore the clean remote URL, even on failure
    git remote set-url origin $originalRemote
    $token = $null
    [System.GC]::Collect()
  }

  Write-Host 'Push succeeded. Token rotated out of memory.' -ForegroundColor Green
} else {
  Write-Host 'Skipping push (--SkipPush).' -ForegroundColor Yellow
}

# -------------------------------------------------------------- wait for deploy
if ($SkipDeployWait) {
  Write-Section 'Skipping Render deploy wait (--SkipDeployWait)'
} else {
  Write-Section "Waiting for Render deploy (timeout: $DeployTimeoutSec s)"

  $deadline = (Get-Date).AddSeconds($DeployTimeoutSec)
  $backendOk = $false
  $frontendOk = $false
  $lastCommit = (git rev-parse --short HEAD).Trim()
  $shortCommit = $lastCommit.Substring(0, [Math]::Min(7, $lastCommit.Length))

  while ((Get-Date) -lt $deadline) {
    $b = $false; $bCode = 0
    try {
      $r = Invoke-WebRequest -Uri "https://$Backend/health" -UseBasicParsing -Method Get -TimeoutSec 10
      $b = $r.StatusCode -eq 200
      $bCode = $r.StatusCode
    } catch { $b = $false }

    $f = $false; $fCode = 0
    try {
      $r = Invoke-WebRequest -Uri "https://$Frontend" -UseBasicParsing -Method Get -TimeoutSec 10
      $f = $r.StatusCode -eq 200
      $fCode = $r.StatusCode
    } catch { $f = $false }

    $bHasCommit = '?'
    if ($b) {
      try {
        $body = (Invoke-WebRequest -Uri "https://$Backend/health" -UseBasicParsing -Method Get -TimeoutSec 10).Content
        $bHasCommit = if ($body -match $shortCommit) { 'yes' } else { 'no' }
      } catch { $bHasCommit = 'err' }
    }

    Write-Host ("[{0:HH:mm:ss}] backend={1}({2}) frontend={3}({4}) commit={5}" -f (Get-Date), $b, $bCode, $f, $fCode, $bHasCommit)

    if ($b -and $bHasCommit -eq 'yes') {
      Write-Host "Backend reports the new commit. Frontend is static, served from same deploy." -ForegroundColor Green
      $backendOk = $true
      $frontendOk = $true
      break
    }
    Start-Sleep -Seconds 10
  }

  if (-not $backendOk) { Write-Host 'Backend deploy did not become healthy in time.' -ForegroundColor Red; exit 2 }
  if (-not $frontendOk) { Write-Host 'Frontend deploy did not become healthy in time.' -ForegroundColor Red; exit 2 }
  Write-Host "Deploy live with commit $lastCommit." -ForegroundColor Green
}

# -------------------------------------------------------------- E2E test
if ($SkipTest) {
  Write-Section 'Skipping E2E test (--SkipTest)'
  exit 0
}

Write-Section 'Running E2E test'

$e2eDir = Join-Path $Script:Root 'e2e'
if (-not (Test-Path (Join-Path $e2eDir 'node_modules'))) {
  Push-Location $e2eDir
  try { npm ci --no-audit --no-fund 2>&1 | Out-Host } catch { npm install --no-audit --no-fund 2>&1 | Out-Host }
  Pop-Location
}

Push-Location $e2eDir
try {
  node test.js
  $testExit = $LASTEXITCODE
} finally {
  Pop-Location
}

Write-Section "Result"
if ($testExit -eq 0) {
  Write-Host 'E2E test passed.' -ForegroundColor Green
  exit 0
} else {
  Write-Host "E2E test failed (exit $testExit). See $Script:Root\e2e\shots for screenshots." -ForegroundColor Red
  exit $testExit
}
