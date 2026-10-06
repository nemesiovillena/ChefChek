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
    albaranes Escribe en Cuiner los albaranes que el usuario envió desde
             ChefChek. En modo simulación (DRY_RUN) ejecuta todo y hace
             ROLLBACK: valida permisos y datos sin dejar nada escrito.
    all      catalog + sales + albaranes.

  Solo escribe en Cuiner la tarea 'albaranes', y únicamente en DocsCab,
  DocsLin, DocsLinAux, DocsSumas (inserción) y el último precio de
  ArticulosProv. El login SQL no tiene permisos de borrado ni de otras tablas.

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
  [ValidateSet('check', 'catalog', 'sales', 'albaranes', 'all')]
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

# ─── Escritura de albaranes (única tarea que escribe en Cuiner) ─────────────

function Invoke-TxScalar {
  param($Conn, $Tx, [string]$Query, [hashtable]$Params = @{})
  $cmd = $Conn.CreateCommand()
  $cmd.Transaction = $Tx
  $cmd.CommandText = $Query
  $cmd.CommandTimeout = 60
  foreach ($name in $Params.Keys) {
    $value = $Params[$name]
    if ($null -eq $value) { $value = [DBNull]::Value }
    [void]$cmd.Parameters.AddWithValue("@$name", $value)
  }
  $result = $cmd.ExecuteScalar()
  if ($result -is [DBNull]) { return $null }
  return $result
}

# Escribe un albarán exactamente como lo guarda Cuiner al grabarlo a mano
# (verificado con un albarán de prueba): cabecera, líneas, línea auxiliar por
# línea, sumas por IVA y último precio del artículo para ese proveedor.
# Devuelve @{ id = Id_DocsCab; existed = $true si ya estaba (idempotencia) }.
function Write-CuinerAlbaran {
  param($Conn, $Tx, $Doc)
  $existing = Invoke-TxScalar $Conn $Tx 'SELECT TOP 1 Id_DocsCab FROM DocsCab WHERE Notas = @notas' @{ notas = $Doc.notas }
  if ($null -ne $existing) { return @{ id = [int]$existing; existed = $true } }

  $idCab = Invoke-TxScalar $Conn $Tx @'
INSERT INTO DocsCab (Empresa, TipoCodigo, Codigo, Centro, Almacen, Fecha, TipoDoc, Serie, Numdoc, Contador,
                     DescuentoP1, DescuentoP2, DescuentoP3, DescuentoI, Total, Moneda, ActUsuario, ActFecha, Notas)
OUTPUT INSERTED.Id_DocsCab
VALUES (@empresa, @tipoCodigo, @codigo, @centro, @almacen, @fecha, @tipoDoc, @serie, @numdoc, 0,
        0, 0, 0, 0, @total, 'E', @actUsuario, GETDATE(), @notas)
'@ @{ empresa = $Doc.empresa; tipoCodigo = $Doc.tipoCodigo; codigo = $Doc.codigo; centro = $Doc.centro;
      almacen = $Doc.almacen; fecha = [datetime]::ParseExact($Doc.fecha, 'yyyy-MM-dd', $null); tipoDoc = $Doc.tipoDoc;
      serie = $Doc.serie; numdoc = $Doc.numdoc; total = [decimal]$Doc.total; actUsuario = $Doc.actUsuario; notas = $Doc.notas }
  $idCab = [int]$idCab

  foreach ($l in $Doc.lineas) {
    # Cuiner guarda el descuento vacío como NULL, no como 0.
    $dto = $null; if ([double]$l.descuentoP -ne 0) { $dto = [decimal]$l.descuentoP }
    $idLin = Invoke-TxScalar $Conn $Tx @'
INSERT INTO DocsLin (Id_DocsCab, Articulo, Descripcion, Unidades, UnidadesPorCaja, Importe, DescuentoP, Base,
                     CosteUM, ImporteUC, TipoIVA, IVA, Centro, Almacen, ActUsuario, ActFecha)
OUTPUT INSERTED.Id_DocsLin
VALUES (@idCab, @articulo, @descripcion, @unidades, @upc, @importe, @dto, @base,
        @costeUM, @importeUC, @tipoIva, @iva, '', '', @actUsuario, GETDATE())
'@ @{ idCab = $idCab; articulo = $l.articulo; descripcion = $l.descripcion; unidades = [double]$l.unidades;
      upc = [double]$l.unidadesPorCaja; importe = [decimal]$l.importe; dto = $dto; base = [decimal]$l.base;
      costeUM = [decimal]$l.costeUM; importeUC = [bool]$l.importeUC; tipoIva = $l.tipoIva; iva = [decimal]$l.iva;
      actUsuario = $Doc.actUsuario }

    [void](Invoke-TxScalar $Conn $Tx 'INSERT INTO DocsLinAux (Id_DocsLin, LOTE, CaducRodeo, NOTAS) VALUES (@id, @lote, NULL, @notas)' `
      @{ id = [int]$idLin; lote = [string]$l.lote; notas = '' })

    # Último precio de compra: solo si la relación artículo-proveedor ya existe
    # y el albarán no es más antiguo que la última compra registrada (un
    # albarán atrasado no debe pisar un precio más reciente).
    [void](Invoke-TxScalar $Conn $Tx @'
UPDATE ArticulosProv
SET UltFecha = @fecha, UltImporte = @importe, UltDescuentoP = @dto, UltIVA = @iva, UltUnPorCaja = @upc,
    UltImporteUC = @importeUC, UltCosteUM = @costeUM, ActUsuario = @actUsuario, ActFecha = GETDATE()
WHERE Empresa = @empresa AND Articulo = @articulo AND Proveedor = @proveedor
  AND (UltFecha IS NULL OR UltFecha <= @fecha)
'@ @{ fecha = [datetime]::ParseExact($Doc.fecha, 'yyyy-MM-dd', $null); importe = [double]$l.importe; dto = $dto;
      iva = [double]$l.iva; upc = [double]$l.unidadesPorCaja; importeUC = [bool]$l.importeUC; costeUM = [double]$l.costeUM;
      actUsuario = $Doc.actUsuario; empresa = $Doc.empresa; articulo = $l.articulo; proveedor = $Doc.codigo })
  }

  foreach ($sum in $Doc.sumas) {
    [void](Invoke-TxScalar $Conn $Tx 'INSERT INTO DocsSumas (Id_DocsCab, TipoIVA, Dtos, Base, Cuota) VALUES (@id, @tipo, 0, @base, @cuota)' `
      @{ id = $idCab; tipo = [decimal]$sum.tipoIva; base = [decimal]$sum.base; cuota = [decimal]$sum.cuota })
  }
  return @{ id = $idCab; existed = $false }
}

function Invoke-AlbaranSync {
  param($Cfg, $Conn, $Remote)
  $pending = Invoke-ChefChekApi $Cfg 'GET' 'albaranes/pending'
  $live = $pending.mode -eq 'LIVE'
  foreach ($item in @($pending.items)) {
    $doc = $item.payload
    $tx = $Conn.BeginTransaction()
    try {
      $res = Write-CuinerAlbaran $Conn $tx $doc
      if ($live) {
        $tx.Commit()
        $body = @{ ok = $true; simulated = $false; idDocsCab = $res.id }
        $what = $(if ($res.existed) { 'ya existía' } else { 'escrito' })
        Write-Log ("Albarán {0} ({1} €): {2} en Cuiner como documento {3}" -f $doc.numdoc, $doc.total, $what, $res.id)
      } else {
        $tx.Rollback()
        $body = @{ ok = $true; simulated = $true }
        Write-Log ("Albarán {0} ({1} €): simulación correcta, ROLLBACK (nada escrito)" -f $doc.numdoc, $doc.total)
      }
    } catch {
      try { $tx.Rollback() } catch { }
      $body = @{ ok = $false; simulated = (-not $live); error = $_.Exception.Message }
      Write-Log ("Albarán {0}: ERROR {1}" -f $doc.numdoc, $_.Exception.Message) 'ERROR'
    }
    [void](Invoke-ChefChekApi $Cfg 'POST' ("albaranes/{0}/result" -f $item.id) $body)
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
    if ($Task -in 'albaranes', 'all') { Invoke-AlbaranSync $cfg $conn $remote }
  }
  Write-Log "Fin tarea '$Task'"
} catch {
  Write-Log $_.Exception.Message 'ERROR'
  $exitCode = 1
} finally {
  if ($conn) { $conn.Dispose() }
}
exit $exitCode
