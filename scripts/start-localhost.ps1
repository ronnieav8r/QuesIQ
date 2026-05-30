param(
  [int]$Port = 3000,
  [string]$HostName = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeExe = "C:\Program Files\nodejs\node.exe"
$nextBin = Join-Path $repoRoot "node_modules\next\dist\bin\next"
$outLog = Join-Path $repoRoot ".codex-dev-out.log"
$errLog = Join-Path $repoRoot ".codex-dev-err.log"

if (-not (Test-Path $nodeExe)) {
  throw "Node was not found at $nodeExe."
}

if (-not (Test-Path $nextBin)) {
  throw "Next was not found under node_modules. Run npm install first."
}

# Some Windows shells expose both Path and PATH, which breaks Start-Process.
[Environment]::SetEnvironmentVariable("Path", "C:\Program Files\nodejs;C:\Windows\system32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0", "Process")
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")

Clear-Content -Path $outLog -ErrorAction SilentlyContinue
Clear-Content -Path $errLog -ErrorAction SilentlyContinue

$process = Start-Process `
  -FilePath $nodeExe `
  -ArgumentList @($nextBin, "dev", "--hostname", $HostName, "--port", "$Port") `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 3

try {
  $response = Invoke-WebRequest -Uri "http://$HostName`:$Port" -UseBasicParsing -TimeoutSec 10
  Write-Output "QuesIQ localhost is running at http://$HostName`:$Port (PID $($process.Id), HTTP $($response.StatusCode))."
} catch {
  Write-Output "Started PID $($process.Id), but localhost did not respond yet. Check $outLog and $errLog."
}
