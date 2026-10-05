<#
.SYNOPSIS
  Conector ChefChek <-> Cuiner. Se ejecuta en el servidor de Cuiner (Windows,
  PowerShell 5.1 de serie: no requiere instalar nada) como tarea programada.

.DESCRIPTION
  Lee el SQL Server local de Cuiner y habla con la API de ChefChek por HTTPS
  saliente (cabecera X-Connector-Token). Tareas:
    check    Comprueba la conexión a SQL y a la API sin enviar nada.
    catalog  Sube proveedores, artículos, precios por proveedor y carta.
    sales    Sube las líneas de venta nuevas (cursor Id_VentasCab en ChefChek).
    all      catalog + sales.

  Este script SOLO LEE de Cuiner. El login SQL que usa no tiene permisos de
  borrado ni de modificación salvo los previstos para el envío de albaranes,
  que se añade en otra fase.

  Las ventas llegan a Cuiner por cintas (cierres Z) que se importan de golpe.
  Para no leer una cinta a medio importar, solo se procesan tickets cuya cinta
  lleva más de 'salesStableMinutes' sin modificarse, y el cursor nunca salta
  por encima de un ticket aún inestable.

.PARAMETER Task
  check | catalog | sales | all

.PARAMETER ConfigPath
  JSON de configuración (ver config.example.json).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ChefChekConector.ps1 -Task check
#>
[CmdletBinding()]
param(
  [ValidateSet('check', 'catalog', 'sales', 'all')]
  [string]$Task = 'all',
  [string]$ConfigPath = 'C:\ChefChekConector\config.json'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Códigos válidos de Cuiner: numéricos con ceros a la izquierda. Hay basura
# histórica ('HUEV', '9.630'...) que la API rechazaría: se salta y se anota.
$CodePattern = '^[0-9]{1,10}$'

# ─── Configuración y log ────────────────────────────────────────────────────

function Read-Config {
  param([string]$Path)
  $cfg = Get-Content -Path $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($key in 'apiUrl', 'tokenFile', 'sqlServer', 'database', 'sqlUser', 'sqlPasswordFile', 'logDir') {
    if (-not $cfg.$key) { throw "Falta '$key' en $Path" }
  }
  $defaults = @{ salesStableMinutes = 30; ticketsPerBatch = 300; catalogChunk = 500; maxBatchesPerRun = 50 }
  foreach ($k in $defaults.Keys) {
    if (-not ($cfg.PSObject.Properties.Name -contains $k)) {
      $cfg | Add-Member -NotePropertyName $k -NotePropertyValue $defaults[$k]
    }
  }
  return $cfg
}

$script:LogFile = $null

function Write-Log {
  param([string]$Message, [string]$Level = 'INFO')
  $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
  Write-Host $line
  if ($script:LogFile) { Add-Content -Path $script:LogFile -Value $line -Encoding UTF8 }
}

function Initialize-Log {
  param($Cfg)
  New-Item -ItemType Directory -Force -Path $Cfg.logDir | Out-Null
  $script:LogFile = Join-Path $Cfg.logDir ('conector-{0}.log' -f (Get-Date -Format 'yyyy-MM-dd'))
  # Conserva 30 días de logs.
  Get-ChildItem -Path $Cfg.logDir -Filter 'conector-*.log' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force
}

# ─── SQL Server (solo lectura) ──────────────────────────────────────────────

function New-SqlConnection {
  param($Cfg)
  $password = (Get-Content -Path $Cfg.sqlPasswordFile -Raw).Trim()
  $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $builder['Data Source'] = $Cfg.sqlServer
  $builder['Initial Catalog'] = $Cfg.database
  $builder['User ID'] = $Cfg.sqlUser
  $builder['Password'] = $password
  $builder['Application Name'] = 'ChefChekConector'
  $builder['Connect Timeout'] = 15
  $conn = New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
  $conn.Open()
  # Lecturas sin bloquear al TPV ni a la gestión.
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET NOCOUNT ON;'
  [void]$cmd.ExecuteNonQuery()
  return $conn
}

function Invoke-SqlQuery {
  param($Conn, [string]$Query, [hashtable]$Params = @{})
  $cmd = $Conn.CreateCommand()
  $cmd.CommandText = $Query
  $cmd.CommandTimeout = 120
  foreach ($name in $Params.Keys) {
    $value = $Params[$name]
    if ($null -eq $value) { $value = [DBNull]::Value }
    [void]$cmd.Parameters.AddWithValue("@$name", $value)
  }
  $table = New-Object System.Data.DataTable
  $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
  [void]$adapter.Fill($table)
  # La coma evita que PowerShell desenrolle una tabla de una sola fila.
  return , $table
}

function Get-Value {
  param($Row, [string]$Column)
  $v = $Row[$Column]
  if ($v -is [DBNull]) { return $null }
  if ($v -is [string]) { return $v.Trim() }
  return $v
}

# ─── API ChefChek ───────────────────────────────────────────────────────────

function Invoke-ChefChekApi {
  param($Cfg, [string]$Method, [string]$Path, $Body = $null)
  $token = (Get-Content -Path $Cfg.tokenFile -Raw).Trim()
  $uri = $Cfg.apiUrl.TrimEnd('/') + '/api/v1/cuiner/connector/' + $Path
  $params = @{
    Uri         = $uri
    Method      = $Method
    Headers     = @{ 'X-Connector-Token' = $token }
    TimeoutSec  = 120
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $json = ConvertTo-Json -InputObject $Body -Depth 10 -Compress
    # PowerShell 5.1 enviaría la cadena en ISO-8859-1: se fuerzan bytes UTF-8.
    $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    $params.ContentType = 'application/json; charset=utf-8'
  }
  try {
    return Invoke-RestMethod @params
  } catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = "$detail $($_.ErrorDetails.Message)" }
    throw "API $Method $Path -> $detail"
  }
}

function Send-InChunks {
  param($Cfg, [string]$Key, [object[]]$Items)
  if (-not $Items -or $Items.Count -eq 0) { return }
  for ($i = 0; $i -lt $Items.Count; $i += $Cfg.catalogChunk) {
    $end = [Math]::Min($i + $Cfg.catalogChunk, $Items.Count) - 1
    $chunk = @($Items[$i..$end])
    [void](Invoke-ChefChekApi -Cfg $Cfg -Method 'PUT' -Path 'catalog' -Body @{ $Key = $chunk })
  }
  Write-Log ("Catálogo {0}: {1} enviados" -f $Key, $Items.Count)
}

# ─── Tareas ─────────────────────────────────────────────────────────────────

function Invoke-Check {
  param($Cfg, $Conn, $Remote)
  $t = Invoke-SqlQuery $Conn 'SELECT DB_NAME() AS db, (SELECT MAX(Id_VentasCab) FROM VentasCab) AS maxVentas, (SELECT COUNT(*) FROM DocsCab) AS docs'
  $row = $t.Rows[0]
  Write-Log ("SQL OK: base {0}, último ticket {1}, documentos {2}" -f $row.db, $row.maxVentas, $row.docs)
  Write-Log ("API OK: activo={0} modo={1} centro={2} cursor ventas={3}" -f $Remote.enabled, $Remote.mode, $Remote.centro, $Remote.lastVentasCabId)
}

function Invoke-CatalogSync {
  param($Cfg, $Conn, $Remote)
  $p = @{ empresa = $Remote.empresa; centro = $Remote.centro }
  $skipped = 0

  $suppliers = foreach ($r in (Invoke-SqlQuery $Conn @'
SELECT ep.Proveedor, p.Nombre, p.Razon, p.CIF, ISNULL(p.Baja, 0) AS Baja
FROM EmpresaProveedores ep JOIN Proveedores p ON p.Id_Proveedores = ep.Id_Proveedores
WHERE ep.Empresa = @empresa
'@ $p).Rows) {
    $code = Get-Value $r 'Proveedor'
    if ($code -notmatch $CodePattern) { $skipped++; continue }
    $name = Get-Value $r 'Nombre'; if (-not $name) { $name = Get-Value $r 'Razon' }; if (-not $name) { $name = $code }
    @{ codigo = $code; nombre = $name; razon = (Get-Value $r 'Razon'); cif = (Get-Value $r 'CIF'); baja = [bool](Get-Value $r 'Baja') }
  }
  Send-InChunks $Cfg 'suppliers' @($suppliers)

  $articles = foreach ($r in (Invoke-SqlQuery $Conn @'
SELECT ea.Articulo, a.Descripcion, a.Manipulacion, a.Medida, ISNULL(a.Baja, 0) AS Baja
FROM EmpresaArticulos ea JOIN Articulos a ON a.Id_Articulos = ea.Id_Articulos
WHERE ea.Empresa = @empresa
'@ $p).Rows) {
    $code = Get-Value $r 'Articulo'
    if ($code -notmatch $CodePattern) { $skipped++; continue }
    $medida = Get-Value $r 'Medida'
    @{ codigo = $code; descripcion = [string](Get-Value $r 'Descripcion'); manipulacion = (Get-Value $r 'Manipulacion');
       medida = $(if ($null -ne $medida) { [double]$medida } else { $null }); baja = [bool](Get-Value $r 'Baja') }
  }
  Send-InChunks $Cfg 'articles' @($articles)

  $articleSuppliers = foreach ($r in (Invoke-SqlQuery $Conn @'
SELECT Articulo, Proveedor, RefProveedor, UltFecha, UltImporte, UltIVA, UltUnPorCaja, UltImporteUC
FROM ArticulosProv WHERE Empresa = @empresa
'@ $p).Rows) {
    $art = Get-Value $r 'Articulo'; $prov = Get-Value $r 'Proveedor'
    if ($art -notmatch $CodePattern -or $prov -notmatch $CodePattern) { $skipped++; continue }
    $fecha = Get-Value $r 'UltFecha'
    @{ articulo = $art; proveedor = $prov; refProveedor = (Get-Value $r 'RefProveedor');
       ultFecha = $(if ($fecha) { ([datetime]$fecha).ToString('yyyy-MM-dd') } else { $null });
       ultImporte = $(if ($null -ne (Get-Value $r 'UltImporte')) { [double](Get-Value $r 'UltImporte') } else { $null });
       ultIva = $(if ($null -ne (Get-Value $r 'UltIVA')) { [double](Get-Value $r 'UltIVA') } else { $null });
       ultUnPorCaja = $(if ($null -ne (Get-Value $r 'UltUnPorCaja')) { [double](Get-Value $r 'UltUnPorCaja') } else { $null });
       ultImporteUC = $(if ($null -ne (Get-Value $r 'UltImporteUC')) { [bool](Get-Value $r 'UltImporteUC') } else { $null }) }
  }
  Send-InChunks $Cfg 'articleSuppliers' @($articleSuppliers)

  # Carta del centro: el mismo código es distinto plato según el tipo (P/I/M).
  $dishes = foreach ($r in (Invoke-SqlQuery $Conn @'
SELECT Tipo, Codigo, MAX(Descripcion) AS Descripcion
FROM CartasLin
WHERE Empresa = @empresa AND Centro = @centro AND Tipo IN ('P', 'I', 'M') AND ISNULL(Baja, 0) = 0
GROUP BY Tipo, Codigo
'@ $p).Rows) {
    $code = Get-Value $r 'Codigo'
    if ($code -notmatch $CodePattern) { $skipped++; continue }
    $name = Get-Value $r 'Descripcion'; if (-not $name) { $name = $code }
    @{ tipo = (Get-Value $r 'Tipo'); producto = $code; nombre = $name }
  }
  Send-InChunks $Cfg 'dishes' @($dishes)

  if ($skipped -gt 0) { Write-Log "Catálogo: $skipped registros con código no numérico omitidos" 'WARN' }
}

function Invoke-SalesSync {
  param($Cfg, $Conn, $Remote)
  $cursor = [int]$Remote.lastVentasCabId

  if ($cursor -eq 0) {
    # Primer arranque: empezar en la última venta para no descontar el histórico.
    $max = (Invoke-SqlQuery $Conn 'SELECT ISNULL(MAX(Id_VentasCab), 0) AS m FROM VentasCab').Rows[0].m
    $res = Invoke-ChefChekApi $Cfg 'POST' 'sales/bootstrap' @{ maxVentasCabId = [int]$max }
    Write-Log ("Ventas: cursor inicial en {0} (no se importa el histórico)" -f $res.lastVentasCabId)
    return
  }

  for ($batch = 0; $batch -lt $Cfg.maxBatchesPerRun; $batch++) {
    $p = @{ cursor = $cursor; stable = [int]$Cfg.salesStableMinutes; n = [int]$Cfg.ticketsPerBatch; empresa = $Remote.empresa; centro = $Remote.centro }

    # Primer ticket aún "caliente" (su cinta se ha tocado hace poco): tope duro.
    $limitRow = (Invoke-SqlQuery $Conn @'
SELECT MIN(c.Id_VentasCab) AS lim
FROM VentasCab c JOIN Ventas v ON v.Id_Ventas = c.Id_Ventas
WHERE c.Id_VentasCab > @cursor AND v.ActFecha >= DATEADD(minute, -@stable, GETDATE())
'@ $p).Rows[0]
    $p.limit = Get-Value $limitRow 'lim'

    $ids = Invoke-SqlQuery $Conn @'
SELECT TOP (@n) c.Id_VentasCab
FROM VentasCab c
WHERE c.Id_VentasCab > @cursor AND (@limit IS NULL OR c.Id_VentasCab < @limit)
ORDER BY c.Id_VentasCab
'@ $p
    if ($ids.Rows.Count -eq 0) { break }
    $newCursor = [int]$ids.Rows[$ids.Rows.Count - 1].Id_VentasCab
    $p.upTo = $newCursor

    # Solo las líneas del centro de este tenant; el cursor avanza igualmente
    # sobre los tickets de otros centros.
    $lines = foreach ($r in (Invoke-SqlQuery $Conn @'
SELECT c.Id_VentasCab, l.Linea, c.Fecha, l.Tipo, l.Producto, l.Unidades,
       ISNULL(l.MediaRacion, 0) AS MediaRacion, ISNULL(l.Anulacion, 0) AS Anulacion
FROM VentasCab c
JOIN Ventas v ON v.Id_Ventas = c.Id_Ventas
JOIN VentasLin l ON l.Id_VentasCab = c.Id_VentasCab
WHERE c.Id_VentasCab > @cursor AND c.Id_VentasCab <= @upTo
  AND v.Empresa = @empresa AND v.Centro = @centro
ORDER BY c.Id_VentasCab, l.Linea
'@ $p).Rows) {
      $producto = Get-Value $r 'Producto'
      if ($producto -notmatch $CodePattern) { continue }
      $units = [double](Get-Value $r 'Unidades')
      # Media ración: consume la mitad. Las anulaciones de ticket ya vienen
      # como tickets con unidades negativas y se envían tal cual.
      if ([bool](Get-Value $r 'MediaRacion')) { $units = $units / 2 }
      @{ idVentasCab = [int](Get-Value $r 'Id_VentasCab'); linea = [int](Get-Value $r 'Linea');
         fecha = ([datetime](Get-Value $r 'Fecha')).ToString('yyyy-MM-dd'); tipo = (Get-Value $r 'Tipo');
         producto = $producto; unidades = $units; anulada = [bool](Get-Value $r 'Anulacion') }
    }
    $lines = @($lines)

    $res = Invoke-ChefChekApi $Cfg 'POST' 'sales' @{ cursor = $newCursor; lines = $lines }
    Write-Log ("Ventas: tickets hasta {0}, {1} líneas del centro, {2} nuevas" -f $newCursor, $lines.Count, $res.inserted)
    $cursor = [int]$res.lastVentasCabId
  }
  if ($null -ne $p.limit) {
    Write-Log ("Ventas: tickets desde {0} en espera (cinta importada hace menos de {1} min)" -f $p.limit, $Cfg.salesStableMinutes)
  }
}

# ─── Principal ──────────────────────────────────────────────────────────────

$cfg = Read-Config $ConfigPath
Initialize-Log $cfg
$conn = $null
$exitCode = 0
try {
  Write-Log "Inicio tarea '$Task' (base $($cfg.database))"
  $remote = Invoke-ChefChekApi $cfg 'GET' 'config'
  $conn = New-SqlConnection $cfg

  if ($Task -eq 'check') {
    Invoke-Check $cfg $conn $remote
  } elseif (-not $remote.enabled) {
    Write-Log 'El conector está desactivado en ChefChek: no se hace nada' 'WARN'
  } else {
    if ($Task -in 'catalog', 'all') { Invoke-CatalogSync $cfg $conn $remote }
    if ($Task -in 'sales', 'all') { Invoke-SalesSync $cfg $conn $remote }
  }
  Write-Log "Fin tarea '$Task'"
} catch {
  Write-Log $_.Exception.Message 'ERROR'
  $exitCode = 1
} finally {
  if ($conn) { $conn.Dispose() }
}
exit $exitCode
