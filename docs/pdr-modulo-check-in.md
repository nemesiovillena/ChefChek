# PDR - Módulo Check-In (control horario legal, turnos y RRHH)

**Fecha**: 2026-10-05
**Estado**: Aprobado (2026-10-05)
**Prioridad**: Alta
**Estimación**: ~180-220 h en 11 fases y 3 oleadas (estimación a grosso modo, sin medir)
**Plan de fases**: `plans/261005-1427-modulo-check-in/`

---

## Contexto

ChefChek no tiene registro de jornada ni gestión de personal. Se necesita cumplir el registro diario de jornada (art. 34.9 ET, RDL 8/2019) y preparar el registro digital obligatorio en tramitación, además de planificar turnos y dar al empleado un portal propio.

**Estado actual (infraestructura reutilizable)**:
- ✅ Módulos por tenant: `MODULE_REGISTRY` + `@RequireModule` + toggle superadmin (sin migración)
- ✅ Secciones por rol: `SECTION_REGISTRY` (`backend/src/modules/role-access/constants/section-registry.ts`)
- ✅ Inalterabilidad: funciones Postgres `forbid_mutation()` / `forbid_mutation_after_seal()` (migración `20260924203049_immutability_guard`)
- ✅ `User.isSharedAccount` (dispositivo compartido de cocina) → base del modo kiosco
- ✅ `Location` (multi-local) → base del centro de trabajo
- ✅ `@nestjs/schedule`, `pdfkit`, `nodemailer`, socket.io, `bcrypt`, almacenamiento privado Bunny (`store-private-attachment.util.ts`), `Alert` + campana, `@dnd-kit` en frontend
- ❌ Sin ficha laboral de empleado (`User` = cuenta de acceso; `StaffMember` = stub de producción)
- ❌ Sin PWA: no hay manifest, service worker, IndexedDB ni uso de geolocalización
- ❌ `Location` sin coordenadas ni radio
- ❌ Sin generación XLSX (no hay `exceljs`)

---

## Decisiones de producto (confirmadas por el usuario, 2026-10-05)

1. **Multiplataforma = PWA** sobre el frontend Next.js actual (móvil, tablet, ordenador, web). Sin app nativa ni tiendas.
2. **Antifraude = PIN personal** en cada fichaje. **Sin imagen ni reconocimiento facial por ahora** (ni foto-verificación).
3. **Reclutamiento fuera**: PDR propio más adelante.
4. **Módulos separados** en el registro: `check-in` (control horario), `turnos` (planificación y ausencias), `rrhh` (portal y documentación). `turnos` y `rrhh` dependen de `check-in`.
5. **Nóminas aplazadas**: ni subida ni consulta de recibos de salario en este PDR.
6. **Aprueba ADMIN** (y OWNER) correcciones, ausencias y hojas de horas. Roles adicionales (p. ej. encargado de sección) se añadirán más adelante; el diseño no debe impedirlo.
7. **PIN solo en kiosco**: quien ficha desde su propia sesión de ChefChek no introduce PIN; en kiosco compartido el PIN es obligatorio.
8. **Turno partido**: una jornada puede tener varios tramos entrada/salida el mismo día; el hueco entre tramos no es tiempo de trabajo.
9. **Prenómina aplazada** junto con las nóminas.
10. **Pausas cortas**: que computen o no como trabajo se activa/desactiva desde Configuración.
11. **Convenio seleccionable desde Configuración**. Tenant Warynessy: hostelería.
12. **Varios centros**: se gestiona desde Configuración (centros y asignación de empleados a centros).
13. **Excel (XLSX)** incluido en los exports, además de PDF y CSV.
14. **Textos legales**: los valida el administrador del tenant desde Configuración, y el módulo no se puede usar hasta que estén validados. El permiso queda preparado para concederlo a otros roles en el futuro.
15. **Fichas desde el equipo**: las fichas de empleado se pueden crear en bloque a partir de las cuentas ya existentes, con su nombre y su puesto de SICTED, para no teclear dos veces lo mismo.
16. **Cuentas compartidas sin acceso a gestión**: fichas, configuración y presencia solo se muestran al administrador (o a futuros roles con ese permiso) desde su cuenta personal; una cuenta compartida nunca los ve, tenga el rol que tenga.

**Supuestos del autor (no confirmados; ver Preguntas Abiertas)**:
- GPS solo en el instante del fichaje; sin seguimiento continuo.
- Documentos con acuse de lectura registrado, no firma electrónica cualificada.
- Convenio = plantilla de parámetros editables (jornada anual, máximos, descansos, franja nocturna, vacaciones), no un motor de reglas completo por convenio.

---

## Marco legal (requisitos que condicionan el diseño)

| Requisito | Fuente | Consecuencia de diseño |
|---|---|---|
| Registro diario con hora de inicio y fin por persona | Art. 34.9 ET | `TimePunch` por evento; jornada derivada |
| Conservación 4 años | Art. 34.9 ET | Sin borrado; baja de empleado no elimina fichajes |
| A disposición de trabajador, representantes e Inspección | Art. 34.9 ET | Consulta propia en portal; export inmediato; enlace de solo lectura |
| Registro fiable, no manipulable | Criterio ITSS / borrador RD | Tabla append-only con trigger + cadena de hash; correcciones como registros nuevos con motivo y autor |
| Registro digital, trazable, acceso remoto | Borrador RD (sin publicar en BOE a 2026-10-05) | Diseñar ya para ese listón; el formato oficial de export aún no existe |
| Horas extra: registro y totalización, máx. 80 h/año | Art. 35 ET | Cómputo por periodo y resumen mensual entregable |
| Geolocalización: información previa, proporcionalidad | LOPDGDD art. 90 | Captura puntual al fichar; cláusula informativa; configurable por centro |
| Biometría = categoría especial | RGPD art. 9 | Descartada en este PDR |

Este PDR no es asesoramiento jurídico: textos legales (cláusulas, protocolo de registro) deben validarse con asesor laboral/DPD antes de producción.

---

## Objetivos

1. Registro de jornada conforme a la ley, inalterable y exportable al instante para una inspección.
2. Fichar desde cualquier dispositivo (personal o kiosco compartido), con PIN, geovalla y sin conexión.
3. Correcciones documentadas y aprobadas, sin tocar el dato original.
4. Hojas de horas con horas ordinarias/extra y aprobación por el encargado.
5. Planificador de turnos visual tipo Skello, con ausencias, alertas legales y coste.
6. Portal único del empleado: fichajes, turnos, vacaciones, documentos, datos, solicitudes, notificaciones.
7. Tres módulos activables por tenant y secciones restringibles por rol.

**Fuera de alcance**: reclutamiento, nóminas (recibos de salario), prenómina, cálculo salarial, reconocimiento facial/foto, seguimiento GPS continuo, firma electrónica cualificada, intercambio de turnos entre empleados, integraciones con software de nómina (A3, Sage…), app nativa.

---

## Especificación

### Módulo `check-in` — Oleada 1

**F1. Empleados y centros de trabajo**
- `Employee`: ficha laboral (nombre, DNI/NIE, NAF, puesto, sección, tipo de contrato, horas semanales pactadas, fecha alta/baja, centro por defecto, coste hora opcional). `userId` opcional: un empleado puede no tener cuenta personal y fichar solo en kiosco.
- `Location` ampliada: `latitude`, `longitude`, `geofenceRadiusM`, `timezone`.
- PIN por empleado (solo para kiosco): 4-6 dígitos, hash `bcrypt`, bloqueo tras intentos fallidos, restablecible por ADMIN.
- Empleado asignable a uno o varios centros (`EmployeeLocation`); con un solo centro la asignación es automática y no se muestra.

**F1b. Configuración del módulo** (pantalla única, solo ADMIN/OWNER)
- **Convenio**: selector de plantilla (inicialmente "Hostelería" y "Personalizado / Estatuto de los Trabajadores"). Al elegir, copia sus parámetros a los ajustes del tenant, donde son editables: jornada anual y semanal, máximo diario, descanso entre jornadas, descanso semanal, franja nocturna, días de vacaciones y cómputo (naturales/laborables), tope de horas extra. Los convenios de hostelería son provinciales: los valores de la plantilla son de partida y el administrador debe contrastarlos con el suyo.
- **Pausas cortas**: interruptor "las pausas computan como tiempo de trabajo".
- **Centros**: coordenadas, radio y modo de geovalla por centro; asignación de empleados.
- **Textos legales**: borradores editables (información sobre registro de jornada, cláusula de geolocalización, protocolo de registro de jornada). El administrador los revisa, ajusta y marca como validados (queda quién, cuándo y versión). **Hasta validar todos los obligatorios no se puede fichar**; el módulo muestra "configuración pendiente". Editar un texto validado crea versión nueva y exige volver a validar, sin bloquear el fichaje mientras tanto.
- El empleado ve el texto informativo vigente la primera vez que ficha desde su sesión y deja acuse.

**F2. Fichaje**
- Tipos: `IN`, `OUT`, `BREAK_START`, `BREAK_END`.
- **Personal**: empleado con sesión propia; botón único según estado; sin PIN (la sesión ya lo identifica).
- **Kiosco**: dispositivo con sesión de cuenta compartida (`isSharedAccount`); elegir nombre → PIN → fichar. PIN siempre exigido.
- Captura: hora del dispositivo + hora de servidor, coordenadas + precisión, resultado de geovalla (`INSIDE`/`OUTSIDE`/`UNAVAILABLE`), dispositivo, origen.
- Geovalla por centro: modo `OFF` / `AVISAR` (ficha y marca) / `BLOQUEAR`. Por defecto `AVISAR`: un GPS impreciso en interior no debe impedir cumplir la obligación de registrar.
- Estado en vivo para gerencia: quién está dentro, en pausa, fuera.

**F3. Sin conexión (PWA)**
- App instalable; pantalla de fichaje disponible sin red.
- Cola local en IndexedDB; cada fichaje lleva UUID generado en cliente → reenvío idempotente.
- Sincroniza al recuperar red o abrir la app (Background Sync donde exista; iOS solo al abrir).
- PIN sin red (kiosco): se cifra con clave pública del servidor (WebCrypto RSA-OAEP) y se valida al sincronizar; si es incorrecto, el fichaje queda `PENDIENTE_REVISION` para el encargado. No se guardan PIN ni hashes en el dispositivo.
- Desfase de reloj: se guarda hora de dispositivo y de recepción; desfases grandes marcan el fichaje para revisión.

**F4. Registro de jornada, correcciones y hojas de horas**
- Jornada diaria derivada de los fichajes; admite turno partido (varios tramos entrada/salida al día); turnos que cruzan medianoche se imputan al día de inicio.
- Correcciones: el empleado o el encargado solicita (olvido, error); se crea `TimePunchAdjustment` con motivo, autor y aprobador. El fichaje original nunca se modifica.
- Cierre automático configurable de jornadas abiertas → marca incidencia, no inventa hora de salida.
- Hoja de horas semanal/mensual: horas trabajadas, pausas, ordinarias vs extra (según horas pactadas), incidencias. Estados `ABIERTA → ENVIADA → APROBADA`; aprobada = sellada.
- Conformidad mensual del empleado (acuse con fecha) sobre su resumen.

**F5. Informes legales y panel de gerencia**
- Registro de jornada por empleado/periodo: PDF (pdfkit) y CSV/XLSX, con fichajes originales, correcciones y totales.
- Resumen de horas extra por periodo.
- Enlace de solo lectura con caducidad para Inspección (por rango y centro), auditado.
- Verificación de integridad (cadena de hash) incluida en el informe.
- Panel: presencia en vivo, incidencias pendientes, horas por empleado/centro, fichajes fuera de geovalla.

### Módulo `turnos` — Oleada 2

**F6. Ausencias, vacaciones y bajas**
- Tipos configurables (vacaciones, baja IT, permiso retribuido, asuntos propios…), con o sin descuento de saldo.
- Saldo anual de vacaciones por empleado; solicitud → aprobación → calendario de equipo.
- Bajas registradas por gerencia con justificante adjunto (privado).
- Festivos por centro.

**F7. Planificador de turnos**
- Rejilla semanal empleados × días, agrupada por sección/puesto; arrastrar y soltar (`@dnd-kit`).
- Plantillas de turno (p. ej. "Mañana 9-17"), copiar semana, turnos partidos, turnos sin asignar.
- Ausencias aprobadas y festivos visibles en la rejilla.
- Borrador → Publicar: notifica a los afectados; cambios posteriores quedan registrados.
- Vistas día/semana/mes; totales de horas por empleado y por día.

**F8. Plan vs real, alertas legales y coste**
- Comparativa turno planificado vs fichaje: retrasos, ausencias sin fichar, exceso.
- Alertas configurables al planificar: descanso entre jornadas < 12 h, > 9 h/día, exceso semanal sobre pactadas, descanso semanal, acumulado de extra anual.
- Coste laboral estimado por día/semana (visible solo con permiso de coste).

### Módulo `rrhh` — Oleada 3

**F9. Portal del empleado**
- Un único "Mi espacio": fichar, mis fichajes, mis turnos, mis ausencias y saldo, mis documentos, mis datos, mis solicitudes, notificaciones.
- Solicitudes unificadas (corrección de fichaje, ausencia, cambio de datos) con estado y respuesta.

**F10. Documentación laboral**
- Contratos, justificantes y otros documentos por empleado; almacenamiento privado; categorías; caducidad opcional con aviso.
- Acuse de lectura con fecha; el empleado puede subir justificantes.
- Sin nóminas (aplazado).

**F11. QA final**
- Verificación transversal de los tres módulos, guía de usuario y actualización de la documentación. Prenómina aplazada.

---

## Arquitectura Técnica

### Modelo de datos nuevo (Prisma; tenant-scoped; migraciones aditivas)

| Modelo | Módulo | Notas |
|---|---|---|
| `Employee` | check-in | `userId?` único; soft-delete; nunca en cascada sobre fichajes |
| `Location` (+campos geo/tz) | core | aditivo, nullable |
| `TimePunch` | check-in | append-only (`forbid_mutation`); `id` = UUID de cliente; `seq`, `prevHash`, `hash`; sin `deletedAt` |
| `TimePunchAdjustment` | check-in | append-only; `ADD`/`VOID`/`REPLACE`; motivo, solicitante, aprobador, estado |
| `Timesheet` | check-in | por empleado y periodo; sellada al aprobar (`forbid_mutation_after_seal`) |
| `CheckInSettings` | check-in | por tenant: convenio elegido + parámetros editables, pausas computables, cierre automático, longitud de PIN |
| `EmployeeLocation` | check-in | asignación empleado↔centro (varios centros) |
| `CheckInLegalText` | check-in | por tenant y tipo: contenido, versión, `validatedByUserId`, `validatedAt`; versiones anteriores se conservan |
| `CheckInLegalAck` | check-in | append-only: acuse del empleado sobre una versión |
| `InspectionAccessLink` | check-in | token hash, rango, caducidad, accesos |
| `AbsenceType`, `Absence`, `LeaveBalance`, `Holiday` | turnos | `Absence` con adjunto privado |
| `ShiftTemplate`, `Shift`, `SchedulePublication` | turnos | `Shift.employeeId?` (turno abierto) |
| `EmployeeDocument`, `DocumentAck` | rrhh | adjunto privado Bunny |
| `EmployeeRequest` | rrhh | solicitudes unificadas |

Las tablas de evidencia (`TimePunch`, `TimePunchAdjustment`) requieren reglas explícitas en Backup (`CHILD_SCOPE_RULES`) y exclusión de Papelera.

### Backend
- `backend/src/modules/check-in/`, `turnos/`, `rrhh/`: controladores por área, `@RequireModule`, importar `AuthModule`.
- Rutas `/api/v1/check-in/*`, `/api/v1/turnos/*`, `/api/v1/rrhh/*`.
- Endpoint de sincronización por lotes idempotente (`POST /check-in/punches/sync`).
- Cron: cierre de jornadas abiertas, avisos de olvido de fichaje, caducidad de documentos.
- Cálculo de jornada en un servicio puro (sin BD) con tests unitarios exhaustivos: medianoche, pausas, DST, correcciones.

### Frontend
- `frontend/src/features/check-in/`, `turnos/`, `rrhh/`; páginas `dashboard/check-in`, `dashboard/turnos`, `dashboard/mi-espacio`.
- Ruta kiosco a pantalla completa `/fichar`.
- PWA: `manifest.webmanifest`, service worker propio acotado (shell de `/fichar` y `mi-espacio` + cola), IndexedDB.
- Entradas en `nav-config.ts` (`NAV_GROUPS`, `ROUTE_MODULE_MAP`).

---

## Dependencies Check

| Dependencia | Estado | Acción |
|---|---|---|
| `@nestjs/schedule`, `pdfkit`, `bcrypt`, `nodemailer` | instaladas | reutilizar |
| `exceljs` (XLSX) | no instalada | añadir en F5 (confirmado) |
| Librería service worker (`serwist`) o SW manual | no instalada | decidir en F3; preferencia SW manual pequeño |
| `idb` (IndexedDB) | no instalada | añadir en F3 |
| Web Push | no instalada | fuera de alcance; campana + email |
| HTTPS en todos los entornos | requerido por geolocalización y SW | verificar en dev (localhost vale) |

---

## Plan de Implementación

| Oleada | Fase | Contenido | Estimación |
|---|---|---|---|
| 1 `check-in` | 1 | Fundaciones: módulos, `Employee`, centros, PIN, Configuración (convenio, pausas, textos legales) | 16-20 h |
| 1 | 2 | Fichaje online personal y kiosco, geovalla | 18-22 h |
| 1 | 3 | PWA y fichaje sin conexión | 20-24 h |
| 1 | 4 | Registro de jornada, correcciones, hojas de horas | 20-24 h |
| 1 | 5 | Informes legales y panel de gerencia | 16-20 h |
| 2 `turnos` | 6 | Ausencias, vacaciones, bajas | 16-18 h |
| 2 | 7 | Planificador de turnos | 28-34 h |
| 2 | 8 | Plan vs real, alertas legales, coste | 12-14 h |
| 3 `rrhh` | 9 | Portal del empleado y solicitudes | 14-16 h |
| 3 | 10 | Documentación laboral | 12-14 h |
| 3 | 11 | QA final de los tres módulos | 10-12 h |

Cada oleada es desplegable por sí sola. La Oleada 1 completa ya cubre la obligación legal.

---

## Criterios de Aceptación

### Legal e integridad
- [ ] `UPDATE`/`DELETE` sobre `TimePunch` falla a nivel de BD
- [ ] Toda corrección conserva original, motivo, autor, aprobador y fecha
- [ ] Informe de registro de jornada de cualquier empleado y mes de los últimos 4 años en < 1 min
- [ ] Verificación de cadena de hash detecta una fila alterada manualmente
- [ ] Dar de baja a un empleado no elimina ni oculta sus fichajes en informes

### Fichaje
- [ ] Fichar desde móvil, tablet y ordenador (personal y kiosco)
- [ ] PIN incorrecto no ficha; bloqueo tras N intentos
- [ ] Geovalla marca `OUTSIDE` y respeta el modo del centro
- [ ] Fichaje sin red se sincroniza una sola vez aunque se reintente
- [ ] Fichaje offline con PIN incorrecto queda en revisión, no se pierde

### Turnos y RRHH
- [ ] Planificar una semana completa con arrastrar y soltar y publicarla notifica a los afectados
- [ ] Ausencia aprobada aparece en el planificador y descuenta saldo
- [ ] El empleado ve solo sus datos; nunca los de otros
- [ ] Sin textos legales validados no se puede fichar; tras validarlos, sí
- [ ] Cambiar de convenio o el interruptor de pausas afecta al cálculo de periodos abiertos, nunca a hojas ya aprobadas

### General
- [ ] Tres módulos activables por tenant; con `check-in` apagado, `turnos` y `rrhh` no son activables
- [ ] Cero pérdida de datos: migraciones aditivas
- [ ] Tests unitarios del cálculo de jornada y e2e de fichaje/sync en verde

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El PIN de kiosco no impide que un compañero fiche por otro si se comparte; en móvil personal basta con prestar la sesión | Fraude residual | Geovalla, kiosco en dispositivo controlado, alerta de fichajes simultáneos/anómalos, conformidad mensual del empleado. Decisión asumida |
| RD de registro digital cambia requisitos o define formato oficial | Retrabajo en informes | Capa de export aislada; datos de origen ya trazables e inmutables |
| iOS: sin sincronización en segundo plano, almacenamiento purgable | Fichajes offline retenidos | Sincronizar al abrir; aviso visible de "pendientes de enviar"; pedir almacenamiento persistente |
| GPS impreciso en interior/sótano | Falsos "fuera de zona" | Modo `AVISAR` por defecto; radio configurable; guardar precisión |
| Reloj del dispositivo manipulado offline | Horas falsas | Guardar hora de recepción y desfase; marcar para revisión |
| Cálculo de jornada (medianoche, DST, pausas) | Horas mal computadas → riesgo legal y de pago | Servicio puro con batería de tests; zona horaria por centro |
| Backup/restore y purge sobre tablas append-only | Restore fallido | Reutilizar escape `chefchek.allow_evidence_purge`; actualizar reglas de backup en F1 |
| Valores de la plantilla de convenio no coinciden con el convenio provincial real | Horas extra y vacaciones mal calculadas | Parámetros editables, aviso visible de "revise estos valores", cifras confirmadas por la gestoría antes de activar |
| El administrador valida textos legales sin revisión profesional | Información al trabajador defectuosa | Los borradores se marcan como orientativos; se recomienda revisión de asesor; queda registro de quién validó |
| Alcance grande (≈200 h) | Desgaste, entregas tardías | Oleadas desplegables; Oleada 1 primero y en uso antes de seguir |
| Datos personales sensibles (DNI, NAF, bajas) | RGPD | Acceso por rol, adjuntos privados, sin datos de salud más allá de fechas y tipo |

---

## Preguntas Abiertas

1. Cifras del convenio de hostelería aplicable a Warynessy (provincia; jornada anual, vacaciones, franja nocturna, descansos): hacen falta para rellenar la plantilla "Hostelería". ¿Las facilita la gestoría?
2. ¿Qué otros convenios deben aparecer en el selector además de Hostelería y Personalizado?

Ninguna bloquea el arranque: la plantilla se entrega editable y con valores del Estatuto de los Trabajadores por defecto.

---

## Referencias

- Competencia: https://www.skello.es/ · https://www.jibble.io/es/ · https://kronjop.com/
- Registro digital: https://www.skello.es/blog/ley-registro-horario-digital-espana-guia-empresas · https://factorial.es/blog/nuevo-registro-horario-digital-espana/ · https://fichme.com/normativa/fichaje-digital-obligatorio
- Biometría: https://augustaabogados.com/la-anulacion-de-la-guia-de-la-aepd-sobre-biometria-que-cambia-para-los-sistemas-de-fichaje/ · https://www.tramitapp.com/blog/es-legal-fichar-con-huella-dactilar-en-la-empresa/
- Patrón de PDR: `docs/pdr-modulo-compras.md`
- Inalterabilidad: `backend/prisma/migrations/20260924203049_immutability_guard/migration.sql`
