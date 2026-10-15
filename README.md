# ChefChek — Control total de tu cocina

Plataforma web para gestionar una cocina profesional de principio a fin: compras, recepción de mercancía, recetas y costes, producción, seguridad alimentaria, calidad y personal. Funciona en ordenador, tablet y móvil.

Cada restaurante es un cliente independiente, con sus datos aislados, y activa solo los módulos que necesita. Cada persona ve lo que corresponde a su rol (propietario, administrador, jefe de cocina, cocinero…).

---

## Qué hace

### 🍳 Cocina
- **Recetas.** Ingredientes, sub-recetas (una salsa o un fondo dentro de otra receta), elaboración paso a paso, fotos y peso final elaborado.
- **Escandallos automáticos.** El coste de cada receta se recalcula solo cuando cambia el precio de un ingrediente. Incluye PVP, % de coste objetivo, margen y precio por kg/L para usar la receta como ingrediente de otra.
- **Fichas técnicas** en PDF, listas para imprimir o enviar.
- **Captura de recetas con IA.** Importa recetas desde una web, un texto o una foto, y las deja en revisión antes de pasarlas a Recetas.
- **Producción.** Órdenes y lotes de producción, y tareas de preparación en el panel principal, que se ordenan arrastrando y se pueden posponer.
- **Notificaciones de sala.** Tablero donde sala comunica a cocina reservas, menús y encargos.

### 📦 Almacén y compras
- **Compras.** Pedidos a proveedores con comparativa de ofertas, envío del pedido, pedidos programados, recepción parcial y aviso de pedidos estancados.
- **Albaranes.** Se fotografía o sube el albarán y la IA lee las líneas: artículo, cantidad, precio neto, descuento y lote. Al confirmarlo se actualizan los precios y se crean los artículos nuevos.
- **Artículos.** Catálogo con formato de compra, precio real por peso bruto/neto, proveedor preferente, foto, y detección y fusión de duplicados.
- **Proveedores.** Datos fiscales, contacto, condiciones, productos asociados y catálogos de precios importados con IA y comparables entre sí.
- **Stock** por almacén.
- **Histórico de precios,** con aviso en la campana de notificaciones cuando un proveedor sube un precio.
- **Conector Cuiner (TPV).** Envía albaranes y recibe ventas para descontar stock.

### 🛡️ Seguridad alimentaria (APPCC)
- **APPCC.** Registros y controles del plan de autocontrol.
- **Alérgenos.** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011), con iconos oficiales. Se heredan de los ingredientes y sub-recetas de cada plato.
- **Etiquetado.** Etiquetas de elaboración y de artículos manipulados, con fechas, conservación, alérgenos, responsable y QR de trazabilidad. Se imprimen directamente en impresora térmica Zebra o en hoja A4.
- **Caducidades.** Vista de lo que caduca y retirada de etiquetas consumidas o desechadas.

### ✅ Calidad turística (SICTED)
- Planes de higiene y mantenimiento convertidos en hojas digitales periódicas (diarias, semanales…) que el equipo marca desde la tablet.
- Registros inalterables: una vez firmados no se pueden modificar, como exige la auditoría.
- Calendario de días de cierre, avisos de hojas vencidas con justificación del responsable y pack de auditoría.

### 👥 Personal
- **Fichaje (Check-In).** Fichaje con PIN desde el móvil o desde un puesto fijo de cocina, con pausas y registro de jornada.
- **Informes de jornada** preparados para la Inspección de Trabajo.
- **Turnos y ausencias.** Planificador de turnos, vacaciones, permisos y bajas, saldos anuales y festivos.
- **Mi espacio.** Cada empleado consulta sus fichajes, turnos y ausencias y solicita cambios de sus datos. La gerencia gestiona solicitudes y documentos del equipo.

### 📋 Carta y conocimiento
- **Menús** y **menú digital con código QR** para los clientes.
- **Wiki de procedimientos** de la cocina.

### 🤖 Herramientas
- **Asistente IA.** Preguntas en lenguaje natural sobre precios, compras, recetas, stock y trazabilidad de lotes, también por voz. Puede abrir directamente la receta o el artículo del que habla.
- **Papelera** para recuperar lo borrado.
- **Copias de seguridad** exportables e importables.
- Modo oscuro y menú adaptado al móvil.

