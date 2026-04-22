$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPidFile = Join-Path $RootDir '.backend.pid'
$FrontendPidFile = Join-Path $RootDir '.frontend.pid'

function Stop-FromPidFile {
  param(
    [string]$Name,
    [string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidText = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($pidText) {
    $parsed = 0
    if ([int]::TryParse($pidText, [ref]$parsed)) {
      $proc = Get-Process -Id $parsed -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "Deteniendo $Name (PID $parsed)..."
        Stop-Process -Id $parsed -Force -ErrorAction SilentlyContinue
      }
    }
  }

  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-ByPort {
  param(
    [string]$Name,
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return
  }

  Write-Host "Liberando puerto $Port ($Name)..."
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
}

Stop-FromPidFile -Name 'backend' -PidFile $BackendPidFile
Stop-FromPidFile -Name 'frontend' -PidFile $FrontendPidFile
Stop-ByPort -Name 'backend' -Port 3000
Stop-ByPort -Name 'frontend' -Port 4200

Write-Host 'Sistema detenido.'
