$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir 'backend'
$FrontendDir = Join-Path $RootDir 'frontend'
$LogDir = Join-Path $RootDir 'logs'
$DockerComposeFile = Join-Path $RootDir 'docker-compose.yml'
$BackendEnvFile = Join-Path $BackendDir '.env'
$BackendEnvExample = Join-Path $BackendDir '.env.example'
$AppUrl = 'http://127.0.0.1:4200/login'

$BackendPidFile = Join-Path $RootDir '.backend.pid'
$FrontendPidFile = Join-Path $RootDir '.frontend.pid'

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Require-Command {
  param([string]$Name)
  if (-not (Test-Command $Name)) {
    throw "Falta el comando requerido: $Name"
  }
}

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

function Ensure-NodeModules {
  param(
    [string]$ServiceName,
    [string]$ServiceDir
  )

  $nodeModulesDir = Join-Path $ServiceDir 'node_modules'
  if (-not (Test-Path $nodeModulesDir)) {
    Write-Host "Instalando dependencias de $ServiceName..."
    Push-Location $ServiceDir
    npm install
    Pop-Location
  }
}

function Wait-Database {
  param([int]$TimeoutSeconds = 90)

  Write-Host 'Esperando PostgreSQL...'

  for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
    & docker compose -f $DockerComposeFile exec -T postgres pg_isready -U postgres -d control_migratorio *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'PostgreSQL disponible.'
      return $true
    }

    Start-Sleep -Seconds 1
  }

  Write-Warning 'PostgreSQL no respondió a tiempo.'
  return $false
}

function Bootstrap-Backend {
  Write-Host 'Preparando backend (Prisma)...'
  Push-Location $BackendDir

  npm run prisma:generate
  npm run prisma:deploy
  npm run prisma:seed

  try {
    npm run prisma:seed:casos-demo
  }
  catch {
    Write-Warning 'No se pudieron cargar casos demo. Se continúa.'
  }

  Pop-Location
}

function Start-ServiceProcess {
  param(
    [string]$Name,
    [string]$WorkingDir,
    [string]$NpmCommand,
    [string]$PidFile,
    [string]$LogFile
  )

  Write-Host "Levantando $Name..."

  $cmdScript = "$NpmCommand >> `"$LogFile`" 2>&1"
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdScript -WorkingDirectory $WorkingDir -PassThru -WindowStyle Hidden

  Set-Content -Path $PidFile -Value $proc.Id -Encoding ascii
  Start-Sleep -Seconds 2

  $running = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
  if (-not $running) {
    throw "Error: $Name no pudo iniciar. Revisa $LogFile"
  }

  Write-Host "$Name iniciado (PID $($proc.Id))"
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 120
  )

  for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return $true
      }
    }
    catch {
      # esperar siguiente intento
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Print-LogsHint {
  Write-Host 'Revisa logs si algo no levanta:'
  Write-Host "  Get-Content -Tail 120 \"$LogDir\\backend.log\""
  Write-Host "  Get-Content -Tail 120 \"$LogDir\\frontend.log\""
}

function Open-Browser {
  param([string]$Url)

  $chromeCandidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
  )

  foreach ($chrome in $chromeCandidates) {
    if (Test-Path $chrome) {
      Start-Process -FilePath $chrome -ArgumentList $Url
      return
    }
  }

  Start-Process $Url
}

if (-not (Test-Path $BackendDir) -or -not (Test-Path $FrontendDir)) {
  throw "No se encontraron carpetas backend/frontend en $RootDir"
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

if (-not (Test-Path $BackendEnvFile) -and (Test-Path $BackendEnvExample)) {
  Copy-Item $BackendEnvExample $BackendEnvFile
  Write-Host 'Se creó backend/.env desde .env.example'
}

Require-Command 'node'
Require-Command 'npm'

if (-not (Test-Command 'docker')) {
  throw 'Falta Docker Desktop. Instálalo para levantar PostgreSQL.'
}

# Limpieza previa
Stop-FromPidFile -Name 'backend' -PidFile $BackendPidFile
Stop-FromPidFile -Name 'frontend' -PidFile $FrontendPidFile
Stop-ByPort -Name 'backend' -Port 3000
Stop-ByPort -Name 'frontend' -Port 4200

Write-Host 'Levantando base de datos...'
& docker compose -f $DockerComposeFile up -d postgres
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo levantar PostgreSQL con docker compose.'
}

$null = Wait-Database

Ensure-NodeModules -ServiceName 'backend' -ServiceDir $BackendDir
Ensure-NodeModules -ServiceName 'frontend' -ServiceDir $FrontendDir

Bootstrap-Backend

Start-ServiceProcess -Name 'backend' -WorkingDir $BackendDir -NpmCommand 'npm run start:dev' -PidFile $BackendPidFile -LogFile (Join-Path $LogDir 'backend.log')
Start-ServiceProcess -Name 'frontend' -WorkingDir $FrontendDir -NpmCommand 'npm start -- --host 127.0.0.1 --port 4200' -PidFile $FrontendPidFile -LogFile (Join-Path $LogDir 'frontend.log')

Write-Host "Esperando frontend en $AppUrl ..."
if (-not (Wait-ForHttp -Url $AppUrl -TimeoutSeconds 120)) {
  Write-Warning "No se detectó frontend en $AppUrl dentro del tiempo esperado."
  Print-LogsHint
  exit 1
}

Open-Browser -Url $AppUrl

Write-Host 'Sistema levantado.'
Write-Host "URL: $AppUrl"
Write-Host "Backend log:  $LogDir\\backend.log"
Write-Host "Frontend log: $LogDir\\frontend.log"
