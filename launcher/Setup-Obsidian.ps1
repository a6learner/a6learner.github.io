# Registers src\content as an Obsidian vault, so the writing desk can open posts in Obsidian.
# Safe: backs up Obsidian's settings first and only edits them while Obsidian is closed.
#   powershell -ExecutionPolicy Bypass -File launcher\Setup-Obsidian.ps1
$ErrorActionPreference = 'Stop'
$vault = (Resolve-Path (Join-Path $PSScriptRoot '..\src\content')).Path
$config = Join-Path $env:APPDATA 'obsidian\obsidian.json'

if (-not (Test-Path $config)) { Write-Host 'Obsidian settings not found. Open Obsidian once, then run this again.'; exit 1 }
if (Get-Process Obsidian -ErrorAction SilentlyContinue) {
    Write-Host 'Please close Obsidian first, then run this again.'
    Write-Host "(Or in Obsidian: Open folder as vault -> $vault)"
    exit 1
}

$json = Get-Content $config -Raw -Encoding UTF8 | ConvertFrom-Json
$existing = $json.vaults.PSObject.Properties | Where-Object { $_.Value.path -eq $vault }
if ($existing) { Write-Host "Already a vault: $vault"; exit 0 }

Copy-Item $config "$config.bak" -Force
$id = -join ((1..16) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$json.vaults | Add-Member -NotePropertyName $id -NotePropertyValue ([pscustomobject]@{ path = $vault; ts = $ts })
$text = $json | ConvertTo-Json -Depth 10 -Compress
[System.IO.File]::WriteAllText($config, $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Registered Obsidian vault: $vault (backup: $config.bak)"
