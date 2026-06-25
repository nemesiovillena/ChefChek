# DOCUMENTACIÓN DE ESPECIFICACIONES - chefchek.com
> **Slogan:** Control total de tu cocina.
> **Filosofía Base:** Inspirado en las mejores prácticas de Recipok, Haddock y la metodología de estandarización de GastroKaizen.
> **Arquitectura:** SaaS Multi-tenant modular con enfoque API-First.

---

## 1. ARQUITECTURA DEL SISTEMA Y NEGOCIO (SaaS MODULAR)

### Autenticación Avanzada (Lucia Auth)
La gestión de sesiones y seguridad de usuarios se implementará utilizando **Lucia Auth (Última versión estable)** en combinación con Prisma. Esto garantiza un sistema de autenticación nativo basado en sesiones seguras almacenadas en la base de datos, eliminando la dependencia de servicios externos opacos y permitiendo un control total sobre el ciclo de vida del usuario.

### Multi-Tenancy Estricto y Control de Acceso (Usuarios y Permisos)
El sistema operará bajo un modelo de aislamiento completo de datos (*Multi-tenant*). Cada empresa cliente (`Company/Tenant`) tendrá sus propios registros de manera estanca, garantizando la seguridad y privacidad de la información de su cocina profesional.
*   **Roles y Permisos:** El administrador del Tenant podrá dar acceso a diferentes usuarios con permisos específicos de edición o visualización para trabajar en equipo (parametrizado según el plan de suscripción elegido y vinculado a las sesiones de Lucia Auth).

### Monetización y Activación por Módulos
La plataforma se desarrollará como un conjunto de servicios interconectados pero independientes. Se comercializará como un ecosistema de herramientas para cocinas profesionales, permitiendo activar o desactivar cada módulo dinámicamente por cliente. El usuario pagará una suscripción dinámica basada únicamente en las herramientas que decide activar.

---

## 2. DICCIONARIO OPERATIVO Y REGLAS DE NEGOCIO

### A. Escandallos, Costeo e Internacionalización Monetaria
* **Compatibilidad Divisa Universal:** El software es compatible de forma nativa con todas las monedas del mundo. Cada Tenant define su configuración local de divisa.
* **Configuración de Referencia (España - Localización por Defecto):**
    * *Moneda:* Euro.
    * *Símbolo:* €.
    * *Número de decimales de redondeo:* 2 decimales para importes finales (con precisión interna de hasta 4 decimales en coste de ingredientes para evitar errores flotantes en microgramos).
    * *Impuesto Directo a la Venta de Comida:* IVA reducido del 10%.
* **El Reto Multi-Unidad:** Un ingrediente debe registrarse bajo tres dimensiones métricas independientes para evitar inconsistencias en el almacén y la base de datos:
    1.  *Unidad de Compra (UC):* Cómo se adquiere del proveedor (Caja de 10 kg, bote de 300 uds, saco de 25 kg).
    2.  *Unidad de Almacenamiento (UA):* Cómo se controla en el inventario o cámara frigorífica (Kilogramos, Litros, Unidades).
    3.  *Unidad de Receta (UR):* Cómo se dosifica exactamente en la cocina (Gramos, Mililitros, Unidades).
* **Dinámica de Mermas y Rendimiento:** El costo de una receta se calcula utilizando el **Precio Neto** del producto limpio y aprovechable, no el precio bruto de compra. El cliente paga el peso bruto, pero la receta se costea con el precio neto real.

### B. Gestión de Contenido Avanzado (TipTap) e Internacionalización (Multiidioma)
* **Soporte Multiidioma Nativo:** Todo el ecosistema de la plataforma (desde la interfaz del usuario hasta los datos de consulta pública) está preparado para la internacionalización multilingüe.
* **Almacenamiento Estructurado en JSON:** Las zonas de texto enriquecido, elaboración y descripciones se gestionarán mediante el editor **TipTap**, salvando el contenido en formato de objeto estructurado **JSON** en lugar de HTML plano. Esto garantiza una manipulación de datos limpia y permite que los agentes de IA realicen traducciones automatizadas perfectas de las recetas sin romper la semántica ni los formatos.
* **Rutas y Slugs Multidioma:** Al traducir cartas, menús o páginas, el sistema adaptará obligatoriamente la estructura del slug URL al idioma de consulta (ej: `/en/contact` en lugar de `/en/contacto`), protegiendo el SEO internacional del restaurante y evitando enlaces rotos.

### C. Estandarización, Componentes y Descarga de Documentos
* **Design System Global:** Todo el desarrollo visual del panel de administración se regirá bajo una paleta de componentes globales unificada (tipografías, botones, formularios, selectores complejos con prefijos telefónicos y tablas). Cualquier cambio en el componente raíz se propagará instantáneamente a toda la plataforma.
* **Componentes Reutilizables de Entrada:** Elementos complejos, como el gestor de subida de imágenes centralizado, se diseñarán para ser agnósticos e invocarse de igual manera desde el editor TipTap como desde las fichas de ingredientes o perfil del restaurante.
* **Hub de Descarga de Documentos:** El sistema centraliza e indexa todos los documentos necesarios para mejorar el control de la cocina, permitiendo la generación y descarga masiva de formatos dinámicos: fichas técnicas parametrizadas (diseños enfocados a pase con prioridad visual/fotografía, o enfocados a producción con prioridad en la secuencia técnica), plantillas de producción, hojas de revisión de cámaras e inventarios físicos.

### D. Alérgenos, Seguridad Alimentaria (APPCC) y Carta Digital QR
* **Trazabilidad Automática:** Los alérgenos declarados en los ingredientes base se propagarán en cascada de forma obligatoria a todas las sub-recetas, platos, menús y cartas digitales.
* **Cumplimiento Legal:** Garantía de cumplimiento con la Ley de información alimentaria al consumidor (**Reglamento UE 1169/2011**).
* **Módulo APPCC:** Registro digital de los controles sanitarios obligatorios de seguridad alimentaria (temperaturas de cámaras, planes de limpieza, control de plagas y recepción de mercancías).
* **Módulo de Sala: Carta Digital QR:** Herramienta para generar códigos QR únicos que dan acceso directo a los comensales a la oferta gastronómica digitalizada.
    * *Idiomas:* Cartas y menús ilimitados en tantos idiomas como el restaurante configure (con slugs dinámicos).
    * *Seguridad:* Filtro interactivo y visualización de la carta de alérgenos en tiempo real.
    * *Branding:* Personalización completa de la interfaz pública (logotipo del restaurante, horarios comerciales, secciones de sugerencias del chef, colores corporativos).

### E. Ingesta Omnicanal: Automatización por IA y Bot de Telegram
* **Ingesta desde Telegram (Canal de Cocina Rápido):** El sistema integrará un Bot de Telegram propietario enlazado al administrador mediante Webhooks seguros. El personal de cocina podrá fotografiar instantáneamente albaranes, facturas o imágenes de productos y enviarlas directamente por el chat. El bot asocia el archivo de forma segura al Tenant correspondiente.
* **Procesamiento de Ingesta Inteligente (OCR + IA):** Los archivos recibidos (vía web o Telegram) se procesan asíncronamente. La IA lee el documento, extrae de manera estructurada los ítems, cantidades y precios, da de alta productos nuevos de forma automática si no existían, y actualiza los costes de ingredientes existentes, disparando el recálculo en cascada de los escandallos.
* **Dashboard Interactivo Moderno:** El panel de control presentará un diseño web limpio, minimalista e intuitivo. Centralizará métricas clave como evolución de costes de proveedores, salud de márgenes financieros de la carta, alarmas de pérdidas de beneficios e ingeniería de menús en tempo real.

### F. Control de Producción, Almacenes y Sprints
* **Partidas de Trabajo y Órdenes de Producción:** Organización de tareas diarias según las zonas físicas de la cocina (Entrantes, Carnes, Pescados, Postres, Cuarto Frío) generando hojas guía de *mise en place*.
* **Hojas de Pedido Automatizadas:** Plantillas de compra clasificadas automáticamente por Proveedor o por Zona de Conservación (Congelados, Cámara de verduras, Almacén seco) a partir del volumen de comensales.
* **Almacenes:** Control de entradas (albaranes), salidas e inventarios teóricos vs. reales.
* **Manual de Procedimiento Operativo (Wiki):** Centro de conocimiento integrado para documentar y estandarizar todos los procesos del restaurante.
* **Módulo Roadmap / Sprint Tracker Interno:** Panel de control de ingeniería para monitorizar y marcar como completadas las tareas de desarrollo de los sprints.