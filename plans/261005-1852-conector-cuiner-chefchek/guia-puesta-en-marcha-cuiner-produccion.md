# Guía: poner en marcha el conector Cuiner en producción (Warynessy)

Sigue los pasos en orden. Cada paso dice **dónde** se hace y **cómo deshacerlo**.
Los scripts ya están en el servidor de Cuiner, en `C:\ChefChekConector\`.

**Para pararlo todo en cualquier momento:** en ChefChek → Cuiner → *Conector y envíos*, desmarca **«Conector activo»** y pulsa Guardar. El conector deja de hacer nada al instante.

---

## Paso 0 · Seguridad (antes de nada)
Durante el desarrollo, Dokploy devolvió en la conversación con el asistente **secretos de producción**. Cámbialos en Dokploy → ChefChek → production:

| Secreto | Dónde | Efecto de cambiarlo |
|---|---|---|
| Contraseña de la base de datos | chefchek-db → contraseña, y la misma en `DATABASE_URL` del backend | Ninguno visible si se cambian a la vez |
| `JWT_SECRET` | backend → Environment | Todos tendrán que volver a iniciar sesión |
| Contraseñas de Bunny (imágenes y backups) | panel de Bunny → Storage → FTP & API Access; después, en el backend | Ninguno |
| `PEXELS_API_KEY` | pexels.com → tu API key; después, en el backend | Ninguno |
| `CONFIG_ENCRYPTION_KEY` | backend → Environment | ⚠️ **Hay que volver a introducir las claves guardadas cifradas** (IA, SMTP…). Cámbiala solo si vas a hacerlo |

Después de cambiar las variables, **redespliega el backend**.

---

## Paso 1 · Publicar ChefChek con el módulo Cuiner
1. Aprueba y fusiona la **PR #268** en `develop`.
2. Crea la PR de release **develop → main** (el flujo habitual) y fusiónala. Dokploy despliega `main` solo.
3. La migración `20261005200000_cuiner_integration` **solo crea tablas nuevas**.

- **Comprobación:** en ChefChek, el SUPERADMIN ve el módulo «Cuiner» en la lista de módulos, desactivado.
- **Deshacer:** desactivar el módulo. Las tablas nuevas no molestan a nada.

---

## Paso 2 · Configurar ChefChek (producción, como administrador de Warynessy)
1. **SUPERADMIN:** activa el módulo **Cuiner** para Warynessy.
2. **ChefChek → Almacén → Cuiner → Conector y envíos:**
   - Conector activo: **sí**
   - Modo: **Simulación**
   - Local en Cuiner: **02 · Warynessy**
   - Usuario de Cuiner que firma los albaranes: **3** (el que firma casi todos los albaranes hoy)
   - Almacén: **Stock general (sin almacén)**
   - **Guardar**
3. Pulsa **Generar token** y **cópialo**: solo se muestra una vez.

---

## Paso 3 · Conectar el servidor de Cuiner, en modo solo lectura
En SRVCUINER, por AnyDesk: **PowerShell como administrador**.

```powershell
cd C:\ChefChekConector

# 3.1 Permiso SOLO DE LECTURA en la base real (comprueba los permisos al final)
powershell -ExecutionPolicy Bypass -File .\PermisosConectorCuiner.ps1 -Nivel Lectura

# 3.2 Apuntar a producción y guardar el token (te lo pide sin mostrarlo)
powershell -ExecutionPolicy Bypass -File .\ConfigurarConector.ps1 -ApiUrl https://api.chefchek.com -BaseDatos Cuiner

# 3.3 Primera sincronización
powershell -ExecutionPolicy Bypass -File .\ChefChekConector.ps1 -Task catalog
powershell -ExecutionPolicy Bypass -File .\ChefChekConector.ps1 -Task sales
```

- **3.1** debe terminar con «Todos los permisos son los esperados».
- **3.2** debe mostrar «SQL OK» y «API OK … modo=DRY_RUN centro=02».
- **3.3** sube unos 113 proveedores, 2.300 artículos y la carta. La primera ejecución de `sales` **no importa el histórico**: coloca el cursor en la última venta y solo cuenta las nuevas a partir de ahí.

**Deshacer:** `.\PermisosConectorCuiner.ps1 -Retirar` (quita el acceso a la base real).

---

## Paso 4 · Enlazar en ChefChek
En **Cuiner → Proveedores / Artículos / Platos**, acepta las sugerencias correctas o busca a mano. No hace falta enlazarlo todo de golpe:
- **Albaranes:** basta con el proveedor y los artículos de los albaranes que vayas a enviar.
- **Ventas:** empieza por los platos que más se venden (salen primero en la lista).

Antes de aplicar ventas, revisa los **16 artículos con el formato mal configurado** (caja o saco contado como 1 unidad). La pestaña Ventas avisa si alguno va a descontarse.

---

## Paso 5 · Primer albarán (contigo delante de la pantalla de Cuiner)
1. **Dar permiso de escritura.** La simulación también lo necesita, porque ejecuta todo y lo deshace:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\PermisosConectorCuiner.ps1 -Nivel Escritura
   ```
2. **Simulación:** en ChefChek, abre un albarán confirmado **pequeño** cuya tarjeta «Cuiner» diga «Listo» y pulsa **Enviar a Cuiner**. Después, en el servidor:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\ChefChekConector.ps1 -Task albaranes
   ```
   Debe decir «simulación correcta, ROLLBACK (nada escrito)». En ChefChek el envío queda como **Simulado**.
3. **Real:** en *Conector y envíos*, cambia el modo a **Real** (pide confirmación). Vuelve al albarán, pulsa **Reenviar a Cuiner** y ejecuta de nuevo `-Task albaranes`. Debe decir «escrito en Cuiner como documento N».
4. **Comprobación en Cuiner:** abre la gestión y busca el albarán del proveedor con ese número. Revisa líneas, precios, descuentos y total.
   - **Si algo no cuadra:** bórralo desde la pantalla de Cuiner, vuelve a poner el modo **Simulación** y avísame con una captura.

---

## Paso 6 · Dejarlo automático
```powershell
powershell -ExecutionPolicy Bypass -File .\InstalarTareasProgramadas.ps1
```
Crea tres tareas, que se ejecutan como SYSTEM:
- **Ventas:** cada 30 min.
- **Albaranes:** cada 5 min. Solo procesa lo que envías con el botón.
- **Catálogo:** a diario a las 09:00.

**Ventas al stock:** las cintas se importan a las 08:00. A partir de las ~08:30, en ChefChek → Cuiner → **Ventas**, revisa la previsualización y pulsa **Aplicar ventas**.

**Deshacer:** `.\InstalarTareasProgramadas.ps1 -Desinstalar`

---

## Dejarlo todo como estaba
1. **ChefChek:** desmarca «Conector activo» (o desactiva el módulo).
2. **Servidor:**
   - `.\InstalarTareasProgramadas.ps1 -Desinstalar`
   - `.\PermisosConectorCuiner.ps1 -Retirar`
3. **Opcional:** borrar `CuinerPruebas`, el login y la carpeta, según la fase 1 (sección «Deshacer todo»).

Los albaranes ya escritos en Cuiner **no se borran solos**: se gestionan desde la pantalla de Cuiner, como cualquier otro.

---

## Pendiente para más adelante
- **Rodeo Diner (centro 01):** cuando exista su tenant, necesitará su propio token y una segunda configuración del conector. Hoy el conector atiende a un tenant por `config.json`.
- **Copias de seguridad de Cuiner:** no hay ninguna desde el 25/03/2026; revisar `copiaSQL`.
