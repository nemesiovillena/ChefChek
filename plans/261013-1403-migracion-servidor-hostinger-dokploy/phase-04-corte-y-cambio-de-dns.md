---
phase: 4
title: Corte y cambio de DNS
status: completed
priority: P1
dependencies:
  - 3
effort: 1h (parada 15-30 min)
---

# Phase 4: Corte y cambio de DNS

## Overview

Parada corta en la ventana acordada: congelar escrituras en el viejo, copia final, repuntar DNS,
emitir certificados y abrir. Cada paso requiere confirmación expresa del usuario en el momento.

## Requirements

- Functional: producción servida desde el servidor nuevo con los datos del último segundo del viejo.
- Non-functional: cero pérdida de datos; vuelta atrás disponible hasta el punto de no retorno.

## Implementation Steps

Previo (día anterior): TTL a 300 s confirmado; congelar merges a `main`; aviso a clientes.

1. **Parar escrituras**: detener `backend` y `frontend` en el Dokploy viejo (`application-stop`).
   Postgres viejo sigue encendido. Desde aquí los usuarios ven error: empieza la parada.
2. Copia final: `scripts/migrate-server/copy-data.sh` (volcado + restore `--clean` + uploads).
3. Verificar conteos de filas y de ficheros contra el viejo. **Si no cuadran → abortar** (paso R).
4. Frontend nuevo: rebuild con las URL reales (`https://api.chefchek.com/api`, etc.) y
   `ALLOWED_ORIGINS=https://app.chefchek.com`; quitar los dominios temporales.
5. Añadir en el Dokploy nuevo los dominios `app.chefchek.com` (:3000) y `api.chefchek.com` (:3001),
   HTTPS + Let's Encrypt.
6. DNS de Hostinger: registros `A` `app` y `api` → IP nueva. La raíz `@` no se toca.
7. Esperar propagación (`dig +short` contra 1.1.1.1 y 8.8.8.8) y arrancar backend + frontend nuevos.
8. Certificados: comprobar con `curl -vI`. Si Traefik sirve `TRAEFIK DEFAULT CERT`, borrar y recrear
   el dominio en Dokploy + `application-reload` (gotcha ya documentado en `docs/deployment.md`).
9. Pruebas de humo en los dominios reales (mismas de la fase 3) + una sincronización del conector Cuiner.
10. **Punto de no retorno**: en cuanto un usuario real escribe datos en el servidor nuevo.
11. Activar autoDeploy en las 3 apps del nuevo; **desactivarlo** en las del viejo. Descongelar `main`.

### R. Vuelta atrás (solo antes del punto de no retorno)

- Si aún no se cambió el DNS: arrancar backend + frontend viejos. Parada terminada, nada perdido.
- Si ya se cambió: repuntar `A` a `72.62.183.215`, arrancar apps viejas, esperar TTL (≤5 min).
- Pasado el punto de no retorno, volver atrás exige migración inversa con el mismo script.

## Success Criteria

- [ ] `dig` devuelve la IP nueva para `app` y `api`.
- [ ] Certificado Let's Encrypt válido en ambos dominios.
- [ ] Pruebas de humo OK en producción; conector Cuiner sincroniza.
- [ ] Apps del servidor viejo paradas y con autoDeploy apagado (no borradas).
- [ ] Un push de prueba a `main` despliega solo en el nuevo.

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| Clientes con DNS cacheado llegan al viejo | Apps viejas paradas → ven error, no escriben en la BD vieja. TTL 300 s |
| Let's Encrypt no emite / rate limit | No pedir certificados antes de que el DNS apunte; recrear dominio; límite 5 fallos/hora |
| Restore incompleto | Verificación por conteo antes de tocar DNS; abortar es gratis en ese punto |
| Push a `main` durante el corte | Merges congelados; autoDeploy apagado en el nuevo hasta el paso 11 |
| Sesiones JWT | Mismo `JWT_SECRET` → los usuarios no tienen que volver a entrar |
