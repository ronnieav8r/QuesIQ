param(
    [ValidateSet('Menu', 'Phone', 'Clear', 'Shell', 'Check', 'Travel')]
    [string]$Mode = 'Menu'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $repoRoot 'apps\mobile'
Set-Location -LiteralPath $mobileRoot
$Host.UI.RawUI.WindowTitle = 'QuesIQ Interview - Development'

# Desktop shells do not necessarily inherit the Codex process PATH.
$nodeDir = Join-Path $env:ProgramFiles 'nodejs'
if (Test-Path (Join-Path $nodeDir 'node.exe')) {
    $env:Path = "$nodeDir;$env:Path"
}

function Start-InterviewPhone {
    param([switch]$ClearCache, [switch]$Tunnel)
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $expo = Join-Path $repoRoot 'node_modules\expo\bin\cli'
    if (-not (Test-Path -LiteralPath $expo)) {
        throw 'Expo dependencies are missing. Run npm.cmd ci from the repository root first.'
    }
    $profile = Get-Content (Join-Path $mobileRoot 'eas.json') -Raw | ConvertFrom-Json
    $env:EXPO_PUBLIC_API_BASE_URL = $profile.build.development.env.EXPO_PUBLIC_API_BASE_URL
    $env:EXPO_PUBLIC_DEV_AUTO_SIGN_IN = 'false'
    if (-not $env:EXPO_PUBLIC_API_BASE_URL) { throw 'Development API URL is missing from eas.json.' }
    Write-Host "API: $env:EXPO_PUBLIC_API_BASE_URL" -ForegroundColor Cyan
    if ($Tunnel) {
        # Expo's Windows global resolver can miss npm's Roaming installation.
        $npmGlobalRoot = (& npm.cmd root --global | Select-Object -Last 1)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to locate global npm packages for the tunnel helper.' }
        $env:NODE_PATH = (@($npmGlobalRoot, $env:NODE_PATH) | Where-Object { $_ }) -join ';'
        Write-Host 'Hotel / travel: both devices need internet; the same Wi-Fi is not required.'
        Write-Host 'Keep this window open. The tunnel URL is public; share it only with your testers.'
        Write-Host 'Tunnel connections may load more slowly or be blocked by some networks.'
    } else {
        Write-Host 'Keep this window open. Connect the PC and phone to the same private Wi-Fi.'
    }
    Write-Host 'Open the installed QuesIQ development app using the QR code below.'
    Write-Host 'Press r to reload; Ctrl+C to stop. Actual app actions use the hosted backend.'
    $connection = if ($Tunnel) { '--tunnel' } else { '--lan' }
    $expoArgs = @($expo, 'start', '--dev-client', $connection, '--port', '8081')
    if ($ClearCache) { $expoArgs += '--clear' }
    & $node @expoArgs
    if ($LASTEXITCODE -ne 0) { Write-Warning "Expo exited with code $LASTEXITCODE. The terminal stays open for troubleshooting." }
}

function Show-InterviewChecks {
    Write-Host "Folder: $mobileRoot"
    & node.exe --version
    & npm.cmd --version
    Write-Host ('Expo installed: ' + (Test-Path (Join-Path $repoRoot 'node_modules\expo\bin\cli')))
    Write-Host ('Development profile present: ' + (Test-Path (Join-Path $mobileRoot 'eas.json')))
    $listeners = @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count) {
        Write-Host 'Port 8081 is already in use. Check the existing Expo window before starting another.'
        $listeners | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table
    } else { Write-Host 'Port 8081 is free.' }
}

Write-Host "`nQuesIQ Interview" -ForegroundColor Cyan
Write-Host '1  Start phone connection (hosted Interview API)'
Write-Host '2  Start phone connection with a fresh Metro cache'
Write-Host '3  Check local tools and port'
Write-Host '4  PowerShell prompt in the mobile app folder'
Write-Host '5  Hotel / travel connection (internet tunnel)'
Write-Host 'At the prompt: .\..\..\scripts\open-interview.ps1 to show this menu again.'
if ($Mode -eq 'Menu') {
    do { $choice = Read-Host 'Choose 1-5 (Enter = 1)' } while ($choice -notin @('', '1', '2', '3', '4', '5'))
    $Mode = switch ($choice) { '2' { 'Clear' }; '3' { 'Check' }; '4' { 'Shell' }; '5' { 'Travel' }; default { 'Phone' } }
}
switch ($Mode) {
    'Phone' { Start-InterviewPhone }
    'Clear' { Start-InterviewPhone -ClearCache }
    'Travel' { Start-InterviewPhone -Tunnel }
    'Check' { Show-InterviewChecks }
    'Shell' { Write-Host 'Ready. Use npm.cmd for npm commands in this PowerShell window.' }
}
