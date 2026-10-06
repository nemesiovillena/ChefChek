<#
.SYNOPSIS
  Instala (o desinstala con -Desinstalar) las tareas programadas del conector
  ChefChek en el servidor de Cuiner. Ejecutar en PowerShell como administrador.

.DESCRIPTION
  Crea dos tareas que se ejecutan como SYSTEM (el único, junto a los
  administradores, que puede leer C:\ChefChekConector\secrets):
    - "ChefChek Conector - Ventas":   cada 30 minutos.
    - "ChefChek Conector - Albaranes": cada 5 minutos (escribe en Cuiner los
      albaranes enviados con «Enviar a Cuiner»; en simulación no escribe).
    - "ChefChek Conector - Catalogo": una vez al día a las 09:00 (después de
      la importación de cintas de las 08:00).
  -Desinstalar elimina ambas tareas. No borra la carpeta C:\ChefChekConector
  ni toca SQL Server: el servidor queda como estaba antes de instalar.
#>
[CmdletBinding()]
param([switch]$Desinstalar)

$ErrorActionPreference = 'Stop'
$Base = 'C:\ChefChekConector'
$Script = Join-Path $Base 'ChefChekConector.ps1'
$Tasks = @{
  'ChefChek Conector - Ventas'   = 'sales'
  'ChefChek Conector - Catalogo' = 'catalog'
  'ChefChek Conector - Albaranes' = 'albaranes'
}

if ($Desinstalar) {
  foreach ($name in $Tasks.Keys) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $name -Confirm:$false
      Write-Host "Eliminada: $name"
    }
  }
  return
}

if (-not (Test-Path $Script)) { throw "No existe $Script" }
if (-not (Test-Path (Join-Path $Base 'config.json'))) { throw "No existe $Base\config.json" }

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
# Nunca dos ejecuciones a la vez; si una se cuelga, se corta a los 20 minutos.
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -StartWhenAvailable

foreach ($name in $Tasks.Keys) {
  $task = $Tasks[$name]
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$Script`" -Task $task" `
    -WorkingDirectory $Base
  if ($task -eq 'sales' -or $task -eq 'albaranes') {
    $minutes = $(if ($task -eq 'sales') { 30 } else { 5 })
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(5) `
      -RepetitionInterval (New-TimeSpan -Minutes $minutes) -RepetitionDuration (New-TimeSpan -Days 3650)
  } else {
    $trigger = New-ScheduledTaskTrigger -Daily -At '09:00'
  }
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null
  Write-Host "Instalada: $name"
}
