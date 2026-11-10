# Creates the "Personal Blog" desktop shortcut. Run:
#   powershell -ExecutionPolicy Bypass -File launcher\Install-Shortcut.ps1
$ErrorActionPreference = 'Stop'
$icon = Join-Path $PSScriptRoot 'PersonalBlog.ico'
if (-not (Test-Path $icon)) { & (Join-Path $PSScriptRoot 'Make-Icon.ps1') }

$script = Join-Path $PSScriptRoot 'Open-Personal-Blog.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Personal Blog.lnk'

$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
$s.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$s.WorkingDirectory = $PSScriptRoot
$s.IconLocation = "$icon,0"
$s.Description = 'Open my blog writing desk'
$s.WindowStyle = 7  # minimized, so no console flashes
$s.Save()
Write-Host "Created $lnk"
