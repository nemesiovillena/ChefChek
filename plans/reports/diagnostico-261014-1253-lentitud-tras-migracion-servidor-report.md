# Diagnóstico: lentitud tras migración de servidor (2026-10-14)

## Resumen
Sin degradación medible en servidor, red ni BD. Servidor nuevo (`72.60.89.213`) = mismo hardware y mismo datacenter (París) que el viejo. Backend responde p50 6 ms / p99 251 ms. No se encontró causa de lentitud en infraestructura; falta reproducir con sesión real en la pantalla concreta que va lenta.

## Mediciones
| Área | Resultado | Estado |
|---|---|---|
| Hardware | 2 vCPU EPYC 9354P, 7.8 GB, sin swap — idéntico al viejo | OK |
| Carga | load 0.00, 98% idle, 0 iowait, 0 steal, 0 OOM en 24 h | OK |
| Contenedores | backend/frontend/ocr healthy; db 87 MB RAM | OK |
| Backend (499 peticiones reales, 13 h) | p50 6 ms, p90 18, p95 31, p99 251, máx 360; 0 >1 s; 0 errores 5xx | OK |
| Ruta más lenta | `PUT /cuiner/connector/catalog` media 212 ms (sync del conector, no usuario) | OK |
| Backend → Postgres | `select 1` 0,37 ms; `product.count` 2,8 ms | OK |
| BD | 29 MB, 438 índices válidos, tablas grandes autoanalizadas | OK |
| Externo (Mac) | `/health` 130 ms, `/login` 160–250 ms, páginas dashboard TTFB 130–220 ms | OK |
| Desde restaurante (SRVCUINER) | ping nuevo 31 ms vs viejo 29 ms; `/health` 45–60 ms; `/login` 80–115 ms; DNS ya resuelve IP nueva | OK |
| HTTP | HTTP/2 + HTTP/3, gzip/br, estáticos `immutable` 1 año | OK |
| WebSocket | handshake polling 200 ms, upgrade 101 | OK |
| Redis | no existe → WS en modo single-instance (aviso en arranque) | Esperado |
| HTTP/3 en Traefik | igual config en servidor viejo | Sin cambio |

## Seguridad / operación
- Puertos 3000 y 5432 cerrados desde fuera; ufw 22/80/443 (+443/udp).
- SSH: `passwordauthentication no`, root solo con clave.
- Certificados Let's Encrypt válidos (curl verifica sin `-k`).
- Copia BD nocturna OK: `2026-10-14 03:30Z`, 161 tablas, subida Bunny HTTP 201.
- Contenedores `Exited (143)` = SIGTERM de redeploys anteriores, normal.

## Observaciones (no causan lentitud)
- `GET /api/v1/health` da 404 (el health real es `/health`).
- CORS sin `Access-Control-Max-Age` → preflight en cada petición con cabeceras propias (~40 ms extra en ruta del restaurante). Preexistente, no cambió con la migración. Mejora opcional: `maxAge: 600` en `enableCors`.
- Backend reiniciado 21:53 del 13/10: los minutos tras cada deploy/corte (DNS propagando, contenedores arrancando) pudieron sentirse lentos.

## Conclusión
Hoy la infraestructura no explica lentitud. Hipótesis restantes: (a) sensación del día de la migración (corte, DNS, redeploys), (b) pantalla/acción concreta pesada en el frontend, (c) red/Wi-Fi o dispositivo concreto.

## Preguntas abiertas
- ¿Qué pantalla o acción va lenta, en qué dispositivo y a qué hora?
- ¿Sigue lento hoy o fue ayer tras el corte?
