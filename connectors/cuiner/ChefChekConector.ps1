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
    contador Enlaza el Contador de platos del TPV (PostgreSQL de Cuiner) con
             ChefChek: escribe en Cuiner las cargas hechas en ChefChek y manda
             el historial nuevo y lo que marca cada plato. Cada minuto.
    all      catalog + sales + albaranes + contador.

  En el PostgreSQL del TPV, 'contador' solo suma o resta raciones en es_stock
  y lo apunta en es_registro (cajero «ChefChek»), igual que una carga del TPV.
  Para SQL Server: solo escribe en Cuiner la tarea 'albaranes', y únicamente en DocsCab,
  DocsLin, DocsLinAux, DocsSumas (inserción) y el último precio de
  ArticulosProv. El login SQL no tiene permisos de borrado ni de otras tablas.

  Las ventas llegan a Cuiner por cintas (cierres Z) que se importan de golpe.
  Para no leer una cinta a medio importar, solo se procesan tickets cuya cinta
  lleva más de 'salesStableMinutes' sin modificarse, y el cursor nunca salta
  por encima de un ticket aún inestable.

.PARAMETER Task
  check | catalog | sales | albaranes | contador | all

.PARAMETER ConfigPath
  JSON de configuración (ver config.example.json).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ChefChekConector.ps1 -Task check
#>
[CmdletBinding()]
param(
  [ValidateSet('check', 'catalog', 'sales', 'albaranes', 'contador', 'all')]
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
  $defaults = @{ salesStableMinutes = 30; ticketsPerBatch = 300; catalogChunk = 500; maxBatchesPerRun = 50; historyBatchesPerRun = 20
    # Contador de platos: PostgreSQL del TPV de Cuiner (solo en este servidor).
    pgPsql = 'C:\Cuiner\pgsql\bin\psql.exe'; pgHost = 'localhost'; pgPort = 5432; pgUser = 'cuiner'; pgDatabase = 'cuiner'
    pgPasswordFile = 'C:\ChefChekConector\secrets\cuiner-pg.txt'; portionRowsPerRun = 2000 }
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

# ─── PostgreSQL del TPV (Contador de platos) ────────────────────────────────

# Ejecuta un script SQL con el psql que trae Cuiner y devuelve su salida en
# una línea (las consultas devuelven un único valor o JSON). Sin -Write la sesión es de solo
# lectura: PostgreSQL rechaza cualquier escritura por error.
function Invoke-Pg {
  param($Cfg, [string]$Sql, [switch]$Write)
  $tmpDir = Join-Path (Split-Path $Cfg.logDir -Parent) 'tmp'
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
  $file = Join-Path $tmpDir ('pg-{0}.sql' -f [guid]::NewGuid().ToString('N'))
  [System.IO.File]::WriteAllText($file, $Sql, (New-Object System.Text.UTF8Encoding $false))
  $oldOut = [Console]::OutputEncoding
  # PowerShell 5.1 convierte en excepción cualquier línea de stderr de psql
  # (avisos incluidos): aquí manda el código de salida.
  $ErrorActionPreference = 'Continue'
  try {
    $env:PGPASSWORD = (Get-Content -Path $Cfg.pgPasswordFile -Raw).Trim()
    $env:PGCLIENTENCODING = 'UTF8'
    $env:PGOPTIONS = $(if ($Write) { '' } else { '-c default_transaction_read_only=on' })
    $env:PGAPPNAME = 'ChefChekConector'
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $out = & $Cfg.pgPsql -h $Cfg.pgHost -p $Cfg.pgPort -U $Cfg.pgUser -d $Cfg.pgDatabase -X -q -A -t -v ON_ERROR_STOP=1 -f $file 2>&1
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL: $(($out | Out-String).Trim())" }
    # json_agg parte el JSON en varias líneas (solo espacios entre elementos).
    return ((@($out | ForEach-Object { "$_" } | Where-Object { $_.Trim() })) -join ' ')
  } finally {
    [Console]::OutputEncoding = $oldOut
    Remove-Item Env:PGPASSWORD, Env:PGOPTIONS -ErrorAction SilentlyContinue
    Remove-Item $file -Force -ErrorAction SilentlyContinue
  }
}

function ConvertTo-PgList {
  param([string[]]$Values)
  return (($Values | ForEach-Object { "'$_'" }) -join ',')
}

# Escribe en Cuiner lo que cambió en ChefChek para un contador: suma (o
# resta) en el plato enlazado que tiene contador en Cuiner y lo apunta en
# es_registro como una carga más, firmada «ChefChek». La marca (id del primer
# pendiente) en 'mesa' evita escribirlo dos veces si falla el aviso a ChefChek.
function Write-PortionPush {
  param($Cfg, $Counter)
  $marker = [string]$Counter.pushIds[0]
  if ($marker -notmatch '^[a-z0-9]{10,40}$') { throw "Marca no válida: $marker" }
  $q = [double]$Counter.pushQuantity
  $values = @()
  foreach ($d in @($Counter.dishes)) {
    if ($d.perPiece -or [string]$d.producto -notmatch $CodePattern) { continue }
    $units = $q / [double]$d.portionsPerSale
    $values += ("('{0}',{1})" -f $d.producto, $units.ToString([Globalization.CultureInfo]::InvariantCulture))
  }
  if (-not $values) { throw 'El contador no tiene platos enlazados que Cuiner cuente por raciones.' }
  $sql = @"
BEGIN;
WITH done AS (
  SELECT plato FROM es_registro WHERE cajero = 'ChefChek' AND mesa = '$marker' LIMIT 1
), cand(plato, units) AS (VALUES $($values -join ',')),
target AS (
  SELECT s.id_es_stock, s.plato, c.units FROM es_stock s JOIN cand c ON c.plato = s.plato
  WHERE s.zona = '' AND NOT EXISTS (SELECT 1 FROM done)
  ORDER BY s.stock DESC NULLS LAST LIMIT 1
), upd AS (
  UPDATE es_stock s SET stock = COALESCE(s.stock, 0) + t.units, consumo = COALESCE(s.consumo, 0)
  FROM target t WHERE s.id_es_stock = t.id_es_stock RETURNING s.plato, t.units
), ins AS (
  INSERT INTO es_registro (fecha, zona, usuario, cajero, mesa, tipo, plato, operacion, unidades)
  SELECT now()::timestamp, '', NULL, 'ChefChek', '$marker', NULL, plato, 'Stock', units FROM upd RETURNING plato
)
SELECT json_build_object('plato', COALESCE((SELECT plato FROM ins), (SELECT plato FROM done)));
COMMIT;
"@
  $res = (Invoke-Pg -Cfg $Cfg -Sql $sql -Write) | ConvertFrom-Json
  if (-not $res.plato) { throw 'Ningún plato enlazado tiene contador en el Contador de platos de Cuiner.' }
  return [string]$res.plato
}

function Invoke-PortionSync {
  param($Cfg, $Remote)
  $pending = Invoke-ChefChekApi $Cfg 'GET' 'portions/sync'
  if (-not $pending.active) { Write-Log 'Contador de platos: módulo desactivado en ChefChek'; return }

  if ($null -eq $pending.cursor) {
    # Primer enlace: se empieza en lo último de Cuiner, sin repasar el pasado.
    $max = [int](Invoke-Pg $Cfg 'SELECT COALESCE(MAX(id_es_registro), 0) FROM es_registro;')
    $res = Invoke-ChefChekApi $Cfg 'POST' 'portions/sync' @{ baseline = $max }
    Write-Log ("Contador de platos: enlazado desde el movimiento {0} de Cuiner" -f $res.cursor)
    return
  }

  # 1. Lo cambiado en ChefChek, a Cuiner.
  $results = @()
  foreach ($c in @($pending.counters)) {
    $ids = @($c.pushIds)
    if ($ids.Count -eq 0) { continue }
    try {
      $plato = $null
      if ([double]$c.pushQuantity -ne 0) { $plato = Write-PortionPush $Cfg $c }
      $results += @{ counterId = $c.id; ids = $ids; ok = $true; plato = $plato }
      Write-Log ("Contador de platos: {0} {1} raciones en Cuiner ({2})" -f $c.name, $c.pushQuantity, $(if ($plato) { "plato $plato" } else { 'se compensan, nada que escribir' }))
    } catch {
      $results += @{ counterId = $c.id; ids = $ids; ok = $false; error = $_.Exception.Message }
      Write-Log ("Contador de platos: {0} NO se pudo escribir en Cuiner: {1}" -f $c.name, $_.Exception.Message) 'ERROR'
    }
  }

  # 2. Historial nuevo y foto del contador, en una sola lectura coherente.
  $platos = @($pending.counters | ForEach-Object { @($_.dishes) } | ForEach-Object { [string]$_.producto } |
    Where-Object { $_ -match $CodePattern } | Sort-Object -Unique)
  $cursor = [int]$pending.cursor
  $body = @{ pushResults = $results }
  if ($platos.Count -gt 0) {
    $list = ConvertTo-PgList $platos
    $limit = [int]$Cfg.portionRowsPerRun
    $sql = @"
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH lim AS (
  SELECT LEAST(COALESCE(MAX(id_es_registro), $cursor), $cursor + $limit) AS hasta, COALESCE(MAX(id_es_registro), $cursor) AS maximo FROM es_registro
)
SELECT json_build_object(
  'hasta', (SELECT hasta FROM lim),
  'completo', (SELECT hasta = maximo FROM lim),
  'rows', COALESCE((SELECT json_agg(r ORDER BY r.id) FROM (
      SELECT id_es_registro AS id, plato, operacion, unidades::float8 AS unidades, cajero, NULLIF(mesa, '') AS mesa
      FROM es_registro WHERE id_es_registro > $cursor AND id_es_registro <= (SELECT hasta FROM lim)
        AND zona = '' AND plato IN ($list)) r), '[]'::json),
  'snapshot', COALESCE((SELECT json_agg(x) FROM (
      SELECT p.plato,
        -- Cuiner deja consumo vacío en un contador recién creado hasta la primera venta.
        (SELECT (s.stock - COALESCE(s.consumo, 0))::float8 FROM es_stock s WHERE s.zona = '' AND s.plato = p.plato LIMIT 1) AS quedan,
        (SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE COUNT(*) FILTER (WHERE l.consumido IS NOT TRUE) END
           FROM es_lotes l WHERE l.zona = '' AND l.plato = p.plato)::float8 AS piezas
      FROM unnest(ARRAY[$list]::text[]) AS p(plato)) x), '[]'::json)
);
COMMIT;
"@
    $read = (Invoke-Pg $Cfg $sql) | ConvertFrom-Json
    $body.cursorFrom = $cursor
    $body.cursorTo = [int]$read.hasta
    $body.rows = @($read.rows)
    $body.snapshot = @($read.snapshot)
    $body.complete = [bool]$read.completo
  }
  $res = Invoke-ChefChekApi $Cfg 'POST' 'portions/sync' $body
  $n = $(if ($body.ContainsKey('rows')) { @($body.rows).Count } else { 0 })
  if ($n -gt 0 -or $results.Count -gt 0) {
    Write-Log ("Contador de platos: {0} movimientos de Cuiner, {1} cargas de ChefChek, cursor {2}" -f $n, $results.Count, $res.cursor)
  }
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
SELECT Tipo, Codigo, MAX(Descripcion) AS Descripcion, MAX(Familias) AS Familias
FROM CartasLin
WHERE Empresa = @empresa AND Centro = @centro AND Tipo IN ('P', 'I', 'M') AND ISNULL(Baja, 0) = 0
GROUP BY Tipo, Codigo
'@ $p).Rows) {
    $code = Get-Value $r 'Codigo'
    if ($code -notmatch $CodePattern) { $skipped++; continue }
    $name = Get-Value $r 'Descripcion'; if (-not $name) { $name = $code }
    # Familia de la carta como ruta «NIVEL1-NIVEL2-NIVEL3»: la usan los informes de ventas.
    @{ tipo = (Get-Value $r 'Tipo'); producto = $code; nombre = $name; familia = (Get-Value $r 'Familias') }
  }
  Send-InChunks $Cfg 'dishes' @($dishes)

  if ($skipped -gt 0) { Write-Log "Catálogo: $skipped registros con código no numérico omitidos" 'WARN' }
}

# Líneas de venta del centro del tenant para los tickets con
# @from < Id_VentasCab <= @to, listas para enviar a ChefChek.
function Get-SaleLines {
  param($Conn, $Remote, [int]$From, [int]$To)
  $p = @{ from = $From; to = $To; empresa = $Remote.empresa; centro = $Remote.centro }
  $lines = foreach ($r in (Invoke-SqlQuery $Conn @'
SELECT c.Id_VentasCab, l.Linea, c.Fecha, l.Tipo, l.Producto, l.Unidades,
       ISNULL(l.MediaRacion, 0) AS MediaRacion, ISNULL(l.Anulacion, 0) AS Anulacion,
       ISNULL(l.Base, 0) AS Base, ISNULL(l.Impuesto, 0) AS Impuesto, ISNULL(l.Invitacion, 0) AS Invitacion
FROM VentasCab c
JOIN Ventas v ON v.Id_Ventas = c.Id_Ventas
JOIN VentasLin l ON l.Id_VentasCab = c.Id_VentasCab
WHERE c.Id_VentasCab > @from AND c.Id_VentasCab <= @to
  AND v.Empresa = @empresa AND v.Centro = @centro
ORDER BY c.Id_VentasCab, l.Linea
'@ $p).Rows) {
    $producto = Get-Value $r 'Producto'
    if ($producto -notmatch $CodePattern) { continue }
    $units = [double](Get-Value $r 'Unidades')
    # Media ración: consume la mitad. Las anulaciones de ticket ya vienen
    # como tickets con unidades negativas y se envían tal cual. La base ya
    # viene calculada por el TPV (con media ración y descuentos).
    if ([bool](Get-Value $r 'MediaRacion')) { $units = $units / 2 }
    @{ idVentasCab = [int](Get-Value $r 'Id_VentasCab'); linea = [int](Get-Value $r 'Linea');
       fecha = ([datetime](Get-Value $r 'Fecha')).ToString('yyyy-MM-dd'); tipo = (Get-Value $r 'Tipo');
       producto = $producto; unidades = $units; anulada = [bool](Get-Value $r 'Anulacion');
       base = [double](Get-Value $r 'Base'); impuesto = [double](Get-Value $r 'Impuesto');
       invitacion = [bool](Get-Value $r 'Invitacion') }
  }
  return ,@($lines)
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

    # Solo las líneas del centro de este tenant; el cursor avanza igualmente
    # sobre los tickets de otros centros.
    $lines = Get-SaleLines $Conn $Remote $cursor $newCursor

    $res = Invoke-ChefChekApi $Cfg 'POST' 'sales' @{ cursor = $newCursor; lines = $lines }
    Write-Log ("Ventas: tickets hasta {0}, {1} líneas del centro, {2} nuevas" -f $newCursor, $lines.Count, $res.inserted)
    $cursor = [int]$res.lastVentasCabId
  }
  if ($null -ne $p.limit) {
    Write-Log ("Ventas: tickets desde {0} en espera (cinta importada hace menos de {1} min)" -f $p.limit, $Cfg.salesStableMinutes)
  }
}

# Histórico para informes: tickets anteriores al conector, de más nuevo a más
# viejo, por lotes. ChefChek los guarda como HISTORICO y nunca descuentan stock.
# Si un lote falla, la siguiente ejecución sigue desde el mismo tope.
function Invoke-HistorySync {
  param($Cfg, $Conn, $Remote)
  $props = $Remote.PSObject.Properties.Name
  if (-not ($props -contains 'historyDone') -or $Remote.historyDone) { return }
  # Primera vez: justo por encima del último ticket recibido, para completar
  # también los importes de las ventas que llegaron sin ellos.
  $upper = if ($null -ne $Remote.historyCursor) { [int]$Remote.historyCursor } else { [int]$Remote.lastVentasCabId + 1 }
  if ($upper -le 1) { return }

  for ($batch = 0; $batch -lt $Cfg.historyBatchesPerRun; $batch++) {
    $ids = Invoke-SqlQuery $Conn @'
SELECT TOP (@n) Id_VentasCab FROM VentasCab WHERE Id_VentasCab < @upper ORDER BY Id_VentasCab DESC
'@ @{ n = [int]$Cfg.ticketsPerBatch; upper = $upper }
    if ($ids.Rows.Count -eq 0) {
      [void](Invoke-ChefChekApi $Cfg 'POST' 'sales/history' @{ cursor = 0; done = $true; lines = @() })
      Write-Log 'Histórico: importación terminada'
      return
    }
    $low = [int]$ids.Rows[$ids.Rows.Count - 1].Id_VentasCab
    $lines = Get-SaleLines $Conn $Remote ($low - 1) ($upper - 1)
    $res = Invoke-ChefChekApi $Cfg 'POST' 'sales/history' @{ cursor = $low; done = $false; lines = $lines }
    Write-Log ("Histórico: tickets {0}-{1}, {2} líneas del centro, {3} nuevas, {4} completadas" -f $low, ($upper - 1), $lines.Count, $res.inserted, $res.completed)
    $upper = $low
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
  if ($Task -ne 'contador') { Write-Log "Inicio tarea '$Task' (base $($cfg.database))" }
  $remote = Invoke-ChefChekApi $cfg 'GET' 'config'
  # El contador de platos solo usa el PostgreSQL del TPV: no abre SQL Server.
  if ($Task -ne 'contador') { $conn = New-SqlConnection $cfg }

  if ($Task -eq 'check') {
    Invoke-Check $cfg $conn $remote
  } elseif (-not $remote.enabled) {
    Write-Log 'El conector está desactivado en ChefChek: no se hace nada' 'WARN'
  } else {
    if ($Task -in 'catalog', 'all') { Invoke-CatalogSync $cfg $conn $remote }
    if ($Task -in 'sales', 'all') {
      Invoke-SalesSync $cfg $conn $remote
      Invoke-HistorySync $cfg $conn $remote
    }
    if ($Task -in 'albaranes', 'all') { Invoke-AlbaranSync $cfg $conn $remote }
    if ($Task -in 'contador', 'all') { Invoke-PortionSync $cfg $remote }
  }
  if ($Task -ne 'contador') { Write-Log "Fin tarea '$Task'" }
} catch {
  Write-Log $_.Exception.Message 'ERROR'
  $exitCode = 1
} finally {
  if ($conn) { $conn.Dispose() }
}
exit $exitCode
