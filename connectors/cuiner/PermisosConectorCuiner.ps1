<#
.SYNOPSIS
  Da (o retira) al login del conector ChefChek acceso a la base REAL de
  Cuiner. Ejecutar en el servidor de Cuiner como administrador.

.DESCRIPTION
  El login 'chefchek_conector' ya existe (se creó para la copia de pruebas
  CuinerPruebas). Este script solo crea su usuario dentro de la base 'Cuiner'
  y le concede permisos mínimos, por niveles:

    -Nivel Lectura    SELECT en catálogos, ventas y albaranes. Suficiente
                      para sincronizar el catálogo y las ventas. Sin escritura.
    -Nivel Escritura  Lo anterior + INSERT en DocsCab, DocsLin, DocsLinAux y
                      DocsSumas + UPDATE de las columnas de último precio de
                      ArticulosProv. Necesario para enviar albaranes.
    -Retirar          Elimina el usuario del conector de la base 'Cuiner'
                      (deja todo como estaba; el login sigue en CuinerPruebas).

  Nunca concede DELETE, ni acceso a otras tablas (p. ej. Usuarios), ni DDL.
  Al terminar comprueba los permisos reales con el propio login.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File PermisosConectorCuiner.ps1 -Nivel Lectura
  powershell -ExecutionPolicy Bypass -File PermisosConectorCuiner.ps1 -Nivel Escritura
  powershell -ExecutionPolicy Bypass -File PermisosConectorCuiner.ps1 -Retirar
#>
[CmdletBinding(DefaultParameterSetName = 'Conceder')]
param(
  [Parameter(ParameterSetName = 'Conceder', Mandatory = $true)]
  [ValidateSet('Lectura', 'Escritura')]
  [string]$Nivel,
  [Parameter(ParameterSetName = 'Retirar', Mandatory = $true)]
  [switch]$Retirar,
  [string]$Instancia = '.\CUINERSQL',
  [string]$BaseDatos = 'Cuiner'
)

$ErrorActionPreference = 'Stop'
$Login = 'chefchek_conector'
$PasswordFile = 'C:\ChefChekConector\secrets\chefchek_conector.txt'

$TablasLectura = @(
  'DocsCab', 'DocsLin', 'DocsLinAux', 'DocsSumas', 'Proveedores', 'EmpresaProveedores',
  'Articulos', 'EmpresaArticulos', 'ArticulosProv', 'TiposIVA', 'Centros', 'Almacenes',
  'Ventas', 'VentasCab', 'VentasLin', 'CartasCab', 'CartasLin', 'EscandallosCab'
)
$TablasInsercion = @('DocsCab', 'DocsLin', 'DocsLinAux', 'DocsSumas')
$ColumnasUltimoPrecio = 'UltFecha, UltImporte, UltDescuentoP, UltDescuentoI, UltIVA, UltUnPorCaja, UltImporteUC, UltCosteUM, ActUsuario, ActFecha'

function Invoke-AdminSql([string]$Sql) {
  $file = Join-Path $env:TEMP 'ck_permisos.sql'
  $Sql | Out-File -Encoding Unicode $file
  try {
    & sqlcmd -S $Instancia -E -d $BaseDatos -b -i $file
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd terminó con código $LASTEXITCODE" }
  } finally {
    Remove-Item $file -Force -ErrorAction SilentlyContinue
  }
}

if ($Retirar) {
  Invoke-AdminSql @"
SET NOCOUNT ON;
IF USER_ID('$Login') IS NOT NULL DROP USER [$Login];
PRINT 'Usuario $Login retirado de la base $BaseDatos';
"@
  return
}

# 1. Usuario del login dentro de la base real (no toca el login ni su clave).
$sql = @"
SET NOCOUNT ON;
IF SUSER_ID('$Login') IS NULL RAISERROR('No existe el login ${Login}: créalo antes (fase 1)', 16, 1);
IF USER_ID('$Login') IS NULL CREATE USER [$Login] FOR LOGIN [$Login];
"@
foreach ($t in $TablasLectura) { $sql += "GRANT SELECT ON dbo.[$t] TO [$Login];`n" }
if ($Nivel -eq 'Escritura') {
  foreach ($t in $TablasInsercion) { $sql += "GRANT INSERT ON dbo.[$t] TO [$Login];`n" }
  $sql += "GRANT UPDATE ON dbo.ArticulosProv ($ColumnasUltimoPrecio) TO [$Login];`n"
} else {
  # Al bajar de Escritura a Lectura se retiran los permisos de escritura.
  foreach ($t in $TablasInsercion) { $sql += "REVOKE INSERT ON dbo.[$t] FROM [$Login];`n" }
  $sql += "REVOKE UPDATE ON dbo.ArticulosProv FROM [$Login];`n"
}
$sql += "PRINT 'Permisos de $Nivel concedidos en $BaseDatos';"
Invoke-AdminSql $sql

# 2. Verificación con el propio login: todo dentro de una transacción que se
#    deshace y con WHERE 1=0, así que no modifica ni una fila.
$env:SQLCMDPASSWORD = (Get-Content $PasswordFile -Raw).Trim()
function Test-Permiso([string]$Etiqueta, [string]$Query, [bool]$DebePermitir) {
  $out = & sqlcmd -S $Instancia -U $Login -d $BaseDatos -b -h -1 -W -Q "SET NOCOUNT ON; BEGIN TRAN; $Query; ROLLBACK" 2>&1 | Out-String
  $permitido = ($LASTEXITCODE -eq 0)
  $ok = ($permitido -eq $DebePermitir)
  Write-Host ('{0} {1,-40} {2}' -f $(if ($ok) { 'OK ' } else { 'MAL' }), $Etiqueta, $(if ($permitido) { 'permitido' } else { 'denegado' }))
  return $ok
}
$escritura = ($Nivel -eq 'Escritura')
$resultados = @(
  Test-Permiso 'Leer ventas (VentasLin)' 'SELECT TOP 1 Producto FROM VentasLin' $true
  Test-Permiso 'Leer catálogo (ArticulosProv)' 'SELECT TOP 1 Articulo FROM ArticulosProv' $true
  Test-Permiso 'Insertar sumas de albarán (0 filas)' 'INSERT INTO DocsSumas SELECT * FROM DocsSumas WHERE 1=0' $escritura
  Test-Permiso 'Borrar albaranes (DocsCab)' 'DELETE FROM DocsCab WHERE 1=0' $false
  Test-Permiso 'Modificar líneas (DocsLin)' 'UPDATE DocsLin SET Unidades=Unidades WHERE 1=0' $false
  Test-Permiso 'Leer usuarios de Cuiner (Usuarios)' 'SELECT TOP 1 Nombre FROM Usuarios' $false
  Test-Permiso 'Crear tablas' 'CREATE TABLE ck_prueba (a int)' $false
)
Remove-Item Env:\SQLCMDPASSWORD
if ($resultados -contains $false) { throw 'Algún permiso no es el esperado: revisa la salida' }
'Todos los permisos son los esperados.'
