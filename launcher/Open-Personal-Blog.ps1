# Opens the personal blog's local writing desk as a desktop app.
#   shortcut -> this script (hidden) -> astro dev on 127.0.0.1:4321 -> wait until healthy
#   -> Edge app window with its own profile -> wait for it to close -> stop only the server we started.
# No autostart, no restarts. Other Node / Edge processes are never touched.
$ErrorActionPreference = 'Stop'

$Project   = Split-Path -Parent $PSScriptRoot
$Port      = 4321
$BaseUrl   = "http://127.0.0.1:$Port"
$AppUrl    = "$BaseUrl/studio"
$DataDir   = Join-Path $env:LOCALAPPDATA 'PersonalBlog'
$EdgeProfile   = Join-Path $DataDir 'EdgeProfile'
$LogFile   = Join-Path $DataDir 'launcher.log'
$ServerOut = Join-Path $DataDir 'server.out.log'
$ServerErr = Join-Path $DataDir 'server.err.log'
$PidFile   = Join-Path $DataDir 'server.pid'
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Log([string]$msg) { Add-Content -Path $LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $msg) -Encoding UTF8 }

function Fail([string]$msg) {
    Log "ERROR: $msg"
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("$msg`n`nLog: $LogFile", 'Personal Blog', 'OK', 'Error') | Out-Null
    exit 1
}

function Test-Healthy {
    try { (Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $false }
}

function Find-Edge {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    $null
}

function Get-OurEdge {
    # Only Edge processes using this app's private profile folder.
    Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($EdgeProfile) }
}

function Stop-OurServer([int]$serverPid) {
    if (-not $serverPid) { return }
    if (Get-Process -Id $serverPid -ErrorAction SilentlyContinue) {
        Log "Stopping server process tree $serverPid"
        & taskkill.exe /PID $serverPid /T /F | Out-Null
    }
    Remove-Item $PidFile -ErrorAction SilentlyContinue
}

$edge = Find-Edge
if (-not $edge) { Fail 'Microsoft Edge was not found.' }
$edgeArgs = @("--app=$AppUrl", "--user-data-dir=`"$EdgeProfile`"", '--disable-background-mode', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--disable-translate', '--disable-features=Translate,msEdgeTranslate')

# A second double click while the app is open: just bring up another window, manage nothing.
$mutex = New-Object System.Threading.Mutex($false, 'Local\PersonalBlogLauncher')
if (-not $mutex.WaitOne(0)) {
    Log 'Launcher already running; opening another window only.'
    Start-Process -FilePath $edge -ArgumentList $edgeArgs | Out-Null
    exit 0
}

$ownedPid = 0
try {
    # A server left behind by a launcher that crashed earlier: stop it only if it is still ours.
    if (Test-Path $PidFile) {
        $old = [int](Get-Content $PidFile -ErrorAction SilentlyContinue)
        $p = Get-CimInstance Win32_Process -Filter "ProcessId = $old" -ErrorAction SilentlyContinue
        if ($p -and $p.CommandLine -and $p.CommandLine.Contains('astro') -and $p.CommandLine.Contains("$Port")) { Stop-OurServer $old }
        Remove-Item $PidFile -ErrorAction SilentlyContinue
    }

    if (Test-Healthy) {
        Log "A server is already running on port $Port (not started by me); it will be left running."
    } else {
        $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($busy) { Fail "Port $Port is used by another program (PID $($busy[0].OwningProcess)) that is not the blog." }

        $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
        if (-not $node) { Fail 'Node.js was not found. Install it from https://nodejs.org' }
        $astro = Join-Path $Project 'node_modules\astro\bin\astro.mjs'
        if (-not (Test-Path $astro)) { Fail "Dependencies are missing. Run 'npm install' in $Project" }

        Log "Starting: astro dev on $BaseUrl"
        $proc = Start-Process -FilePath $node -ArgumentList @("`"$astro`"", 'dev', '--host', '127.0.0.1', '--port', "$Port") `
            -WorkingDirectory $Project -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $ServerOut -RedirectStandardError $ServerErr
        $ownedPid = $proc.Id
        Set-Content -Path $PidFile -Value $ownedPid
        Log "Server PID $ownedPid"

        $deadline = (Get-Date).AddSeconds(90)
        while (-not (Test-Healthy)) {
            if ($proc.HasExited) { Fail "The blog server stopped while starting.`nSee $ServerErr" }
            if ((Get-Date) -gt $deadline) { Fail 'The blog server did not become ready within 90 seconds.' }
            Start-Sleep -Milliseconds 500
        }
        Log 'Server is healthy.'
    }

    Log "Opening Edge app window: $AppUrl"
    $win = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru
    $win.WaitForExit()
    # Edge may hand the window to a child process; wait until no process uses our profile.
    while (Get-OurEdge) { Start-Sleep -Seconds 1 }
    Log 'Window closed.'
}
catch {
    Fail "Unexpected error: $($_.Exception.Message)"
}
finally {
    Stop-OurServer $ownedPid
    $mutex.ReleaseMutex()
    Log 'Launcher finished.'
}
