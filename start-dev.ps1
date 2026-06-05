param(
    [switch]$NoInstall,
    [switch]$StayOpen
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'
$clientDir = Join-Path $root 'client'

function Start-ProjectProcess {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $args = @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        "Set-Location -LiteralPath '$WorkingDirectory'; $Command"
    )

    Start-Process -FilePath 'powershell.exe' -ArgumentList $args | Out-Null
    Write-Host "[$Name] iniciado en: $WorkingDirectory" -ForegroundColor Green
}

if (-not (Test-Path $serverDir)) { throw "No se encontró la carpeta del backend: $serverDir" }
if (-not (Test-Path $clientDir)) { throw "No se encontró la carpeta del frontend: $clientDir" }

if (-not $NoInstall) {
    Write-Host 'Instalando dependencias del backend y frontend...' -ForegroundColor Cyan
    Push-Location $serverDir
    npm install
    Pop-Location

    Push-Location $clientDir
    npm install
    Pop-Location
}

Start-ProjectProcess -Name 'Backend' -WorkingDirectory $serverDir -Command 'npm run dev'
Start-ProjectProcess -Name 'Frontend' -WorkingDirectory $clientDir -Command 'npm run dev'

Write-Host ''
Write-Host 'Servicios iniciados.' -ForegroundColor Yellow
Write-Host 'Backend:  http://localhost:5000/api' -ForegroundColor Yellow
Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Cada servicio se abrió en una ventana separada de PowerShell.' -ForegroundColor DarkGray

if (-not $StayOpen) {
    Write-Host 'Puedes cerrar esta ventana; los procesos seguirán en sus propias ventanas.' -ForegroundColor DarkGray
}

