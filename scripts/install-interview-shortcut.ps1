$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'open-interview.ps1'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'QuesIQ Interview.lnk'
# Convert the existing brand asset into a Windows icon (PNG-backed ICO).
$iconFolder = Join-Path $env:LOCALAPPDATA 'QuesIQ'
New-Item -ItemType Directory -Path $iconFolder -Force | Out-Null
$iconPath = Join-Path $iconFolder 'quesiq-interview.ico'
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile((Join-Path $repoRoot 'public\brand\quesiq-icon.png'))
$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$png = New-Object System.IO.MemoryStream
try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $scale = [Math]::Min(256.0 / $source.Width, 256.0 / $source.Height)
    $width = [int]($source.Width * $scale)
    $height = [int]($source.Height * $scale)
    $graphics.DrawImage($source, [int]((256 - $width) / 2), [int]((256 - $height) / 2), $width, $height)
    $bitmap.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $png.ToArray()
    $writer = New-Object System.IO.BinaryWriter ([System.IO.File]::Create($iconPath))
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
        $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$bytes.Length); $writer.Write([uint32]22)
        $writer.Write($bytes)
    } finally { $writer.Dispose() }
} finally {
    $png.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $source.Dispose()
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = '-NoLogo -NoProfile -NoExit -ExecutionPolicy Bypass -File "' + $launcher + '"'
$shortcut.WorkingDirectory = Join-Path $repoRoot 'apps\mobile'
$shortcut.Description = 'Start QuesIQ Interview phone development or open a troubleshooting PowerShell.'
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Save()
Write-Host "Created: $shortcutPath"
