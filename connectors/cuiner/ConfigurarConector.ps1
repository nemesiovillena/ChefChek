<#
.SYNOPSIS
  Apunta el conector a un ChefChek y a una base de Cuiner, guarda el token de
  forma protegida y comprueba la conexión. Ejecutar en el servidor de Cuiner
  como administrador.

.DESCRIPTION
  - Pide el token del conector sin mostrarlo en pantalla (lo genera ChefChek en
    Cuiner → Conector y envíos → Generar token) y lo guarda en
    C:\ChefChekConector\secrets\connector-token.txt (solo Administradores y SYSTEM).
  - Escribe config.json con la URL de la API y la base de datos indicadas,
    conservando una copia del config anterior (config.json.bak).
  - Lanza la tarea 'check' del conector: no envía ni escribe nada.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File ConfigurarConector.ps1 -ApiUrl https://api.chefchek.com -BaseDatos Cuiner
  powershell -ExecutionPolicy Bypass -File ConfigurarConector.ps1 -ApiUrl https://api.chefchek.com -BaseDatos Cuiner -MantenerToken
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ApiUrl,
  [Parameter(Mandatory = $true)][ValidateSet('Cuiner', 'CuinerPruebas')][string]$BaseDatos,
  [switch]$MantenerToken
)

$ErrorActionPreference = 'Stop'
$Base = 'C:\ChefChekConector'
$Secrets = Join-Path $Base 'secrets'
$TokenFile = Join-Path $Secrets 'connector-token.txt'
$ConfigFile = Join-Path $Base 'config.json'

if ($ApiUrl -notmatch '^https://' -and $ApiUrl -notmatch '^http://100\.') {
  throw 'La URL de la API debe ser https:// (o la IP de Tailscale 100.x para pruebas)'
}

if (-not $MantenerToken) {
  $secure = Read-Host 'Pega el token del conector (no se mostrará)' -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  if ($plain -notmatch '^ckc_') { throw 'Eso no parece un token del conector (empieza por ckc_)' }
  Set-Content -Path $TokenFile -Value $plain -NoNewline
  Remove-Variable plain
} elseif (-not (Test-Path $TokenFile)) {
  throw "No hay token guardado en $TokenFile"
}

if (Test-Path $ConfigFile) { Copy-Item $ConfigFile "$ConfigFile.bak" -Force }
$config = [ordered]@{
  apiUrl             = $ApiUrl.TrimEnd('/')
  tokenFile          = $TokenFile
  sqlServer          = '.\CUINERSQL'
  database           = $BaseDatos
  sqlUser            = 'chefchek_conector'
  sqlPasswordFile    = Join-Path $Secrets 'chefchek_conector.txt'
  logDir             = Join-Path $Base 'logs'
  salesStableMinutes = 30
  ticketsPerBatch    = 300
  catalogChunk       = 500
  maxBatchesPerRun   = 50
}
$config | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8
Write-Host "config.json → API $($config.apiUrl), base $BaseDatos (copia anterior en config.json.bak)"

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Base 'ChefChekConector.ps1') -Task check
if ($LASTEXITCODE -ne 0) {
  throw 'La comprobación ha fallado: revisa el log en C:\ChefChekConector\logs (config.json.bak tiene la configuración anterior)'
}
