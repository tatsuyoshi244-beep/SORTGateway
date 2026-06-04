# SORT Gateway terminal manager
# Usage: .\gateway.ps1 status|start|stop|restart|open|setup
# Docs:  ..\TERMINAL.md
param(
    [Parameter(Position = 0)]
    [ValidateSet('status', 'start', 'stop', 'restart', 'open', 'setup')]
    [string]$Action = 'status',

    [switch]$Background
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$ServerDir = Join-Path $Root 'server'
$PidFile = Join-Path $ServerDir 'data\gateway.pid'
$EnvFile = Join-Path $ServerDir '.env'
$LogDir = Join-Path $Root 'logs'
$LogFile = Join-Path $LogDir 'gateway.log'

function Get-GatewayPort {
    if (Test-Path $EnvFile) {
        $line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
        if ($line -match '=\s*(\d+)') { return [int]$Matches[1] }
    }
    return 3001
}

function Get-PidRecord {
    if (-not (Test-Path $PidFile)) { return $null }
    try {
        return Get-Content $PidFile -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Test-ProcessAlive([int]$ProcessId) {
    if ($ProcessId -le 0) { return $false }
    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Get-PortOwner([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { return $conn.OwningProcess }
    return $null
}

function Test-Health([int]$Port) {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
        return [bool]$r.ok
    } catch {
        return $false
    }
}

function Show-Status {
    $port = Get-GatewayPort
    $rec = Get-PidRecord
    $portPid = Get-PortOwner $port
    $healthy = Test-Health $port

    Write-Host ''
    Write-Host '=== SORT Gateway ===' -ForegroundColor Cyan
    Write-Host "URL:     http://127.0.0.1:$port"
    Write-Host "Port:    $port"

    if ($rec) {
        $alive = Test-ProcessAlive $rec.pid
        $state = if ($alive) { 'running' } else { 'stale pid file' }
        Write-Host "PID:     $($rec.pid) ($state)"
        Write-Host "Started: $($rec.startedAt)"
    } else {
        Write-Host 'PID:     (no pid file)'
    }

    if ($portPid) {
        Write-Host "Listen:  PID $portPid on port $port"
    } else {
        Write-Host 'Listen:  not listening'
    }

    $healthText = if ($healthy) { 'OK' } else { 'DOWN' }
    Write-Host "Health:  $healthText"

    $envText = if (Test-Path $EnvFile) { 'found' } else { 'MISSING (run: .\gateway.ps1 setup)' }
    Write-Host "Env:     $envText"
    Write-Host ''
}

function Ensure-Env {
    if (-not (Test-Path $EnvFile)) {
        Write-Host '[SORT] Creating .env ...' -ForegroundColor Yellow
        Push-Location $ServerDir
        node scripts/setup-env.js
        Pop-Location
        Write-Host '[SORT] Edit ANTHROPIC_API_KEY in server\.env then start again.' -ForegroundColor Yellow
        exit 1
    }
    if (-not (Test-Path (Join-Path $ServerDir 'node_modules'))) {
        Write-Host '[SORT] npm install...' -ForegroundColor Yellow
        Push-Location $ServerDir
        npm install --silent
        Pop-Location
    }
}

function Stop-Gateway {
    $port = Get-GatewayPort
    $stopped = $false

    $rec = Get-PidRecord
    if ($rec -and (Test-ProcessAlive $rec.pid)) {
        Write-Host "[SORT] Stopping PID $($rec.pid)..."
        Stop-Process -Id $rec.pid -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

    $portPid = Get-PortOwner $port
    if ($portPid -and ((-not $stopped) -or ($portPid -ne $rec.pid))) {
        Write-Host "[SORT] Stopping port $port owner PID $portPid..."
        Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }

    Start-Sleep -Milliseconds 400
    if (-not (Get-PortOwner $port)) {
        Write-Host '[SORT] Stopped.' -ForegroundColor Green
    } else {
        Write-Host '[SORT] Port still in use. Close the terminal or run stop again.' -ForegroundColor Red
    }
}

function Start-Gateway {
    Ensure-Env
    $port = Get-GatewayPort

    if (Test-Health $port) {
        Write-Host "[SORT] Already running on port $port" -ForegroundColor Yellow
        Show-Status
        return
    }

    if (Get-PortOwner $port) {
        Write-Host "[SORT] Port $port is busy. Run: .\gateway.ps1 stop" -ForegroundColor Red
        exit 1
    }

    if (-not $Background) {
        Write-Host '[SORT] Starting in this terminal (Ctrl+C to stop)...' -ForegroundColor Green
        Write-Host "         http://127.0.0.1:$port"
        Write-Host ''
        Push-Location $ServerDir
        node index.js
        Pop-Location
        return
    }

    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

    Write-Host '[SORT] Starting in background...' -ForegroundColor Green
    $arg = "/c node index.js >> `"$LogFile`" 2>&1"
    $proc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList $arg `
        -WorkingDirectory $ServerDir `
        -WindowStyle Hidden `
        -PassThru

    $deadline = (Get-Date).AddSeconds(8)
    while ((Get-Date) -lt $deadline) {
        if (Test-Health $port) {
            Write-Host "[SORT] Running (PID $($proc.Id)). Log: $LogFile" -ForegroundColor Green
            Show-Status
            return
        }
        Start-Sleep -Milliseconds 300
    }

    Write-Host '[SORT] Start timed out. Check log:' $LogFile -ForegroundColor Red
    exit 1
}

function Open-Browser {
    $port = Get-GatewayPort
    if (-not (Test-Health $port)) {
        Write-Host '[SORT] Server is down. Start: .\gateway.ps1 start -Background' -ForegroundColor Red
        exit 1
    }
    Start-Process "http://127.0.0.1:$port"
}

switch ($Action) {
    'status'  { Show-Status }
    'start'   { Start-Gateway }
    'stop'    { Stop-Gateway; Show-Status }
    'restart' { Stop-Gateway; Start-Sleep -Seconds 1; Start-Gateway }
    'open'    { Open-Browser }
    'setup'   {
        Push-Location $ServerDir
        node scripts/setup-env.js
        Pop-Location
    }
}
