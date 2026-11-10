# Removes the desktop shortcut and the app's Edge profile and logs. Never touches the blog's content.
#   powershell -ExecutionPolicy Bypass -File launcher\Uninstall-Shortcut.ps1
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Personal Blog.lnk'
if (Test-Path $lnk) { Remove-Item $lnk; Write-Host "Removed $lnk" } else { Write-Host 'No shortcut found.' }
$data = Join-Path $env:LOCALAPPDATA 'PersonalBlog'
if (Test-Path $data) { Remove-Item -Recurse -Force $data; Write-Host "Removed $data" }
