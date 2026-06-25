# Sistema de Carta Digital QR

## Resumen Ejecutivo

El sistema de carta digital QR permite a los restaurantes ofrecer cartas digitales interactivas a sus clientes mediante códigos QR. Los clientes escanean el código QR desde su dispositivo móvil para acceder a una landing page responsive con la carta del restaurante, con funcionalidades de multi-idioma, filtros de alérgenos en tiempo real, y analytics de uso.

## Arquitectura del Sistema

### Componentes Principales

```
Sistema Carta Digital QR
├── Backend (NestJS)
│   ├── DTOs y Validaciones
│   ├── Servicio de Cartas Digitales
│   ├── Controlador REST API
│   └── Módulo NestJS
├── Frontend (Next.js + shadcn/ui)
│   ├── Dashboard de Gestión
│   ├── Generador de QR
│   ├── Gestor de Traducciones
│   ├── Configurador de Filtros
│   └── Vista de Analytics
└── Landing Page Pública
    ├── Vista Responsive
    ├── Selector de Idioma
    ├── Filtros de Alérgenos
    └── Tracking de Analytics
```

### Flujo de Usuario

```
1. Restaurante crea carta digital
   ├── Configura branding
   ├── Selecciona categorías
   ├── Configura multi-idioma
   └── Genera código QR

2. Código QR impreso en mesas
   ├── QR escaneado por cliente
   ├── Redirect a landing page
   ├── Carga carta en idioma detectado
   └── Aplica filtros de alérgenos

3. Cliente interactúa con carta
   ├── Navega por categorías
   ├── Filtra por alérgenos
   ├── Cambia idioma
   └── Visualiza detalles de items

4. Analytics capturados
   ├── Vistas de carta
   ├── Interacciones de usuario
   ├── Idiomas utilizados
   └── Items más vistos
```

## Modelos de Datos

### DigitalMenu

```typescript
interface DigitalMenu {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  categories: string[];
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  branding: MenuBranding;
  allergenFilters: AllergenFilterConfig;
  multiLanguage: MultiLanguageConfig;
  qrCodeId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### MenuTranslation

```typescript
interface MenuTranslation {
  id: string;
  menuId: string;
  language: MenuLanguage;
  name: string;
  description?: string;
  categoryTranslations: Record<string, string>;
  itemTranslations: Record<string, ItemTranslation>;
  createdAt: Date;
  updatedAt: Date;
}

interface ItemTranslation {
  name: string;
  description: string;
}
```

### MenuAnalytics

```typescript
interface MenuAnalytics {
  id: string;
  menuId: string;
  eventType: 'view' | 'interaction';
  language?: MenuLanguage;
  deviceId?: string;
  userAgent?: string;
  interactionType?: InteractionType;
  itemId?: string;
  categoryId?: string;
  selectedAllergens?: string[];
  metadata?: Record<string, any>;
  timestamp: Date;
}
```

## Funcionalidades Principales

### 1. Gestión de Cartas Digitales

**Endpoints:**

```http
POST /api/v1/digital-menus - Crear carta digital (ADMIN)
GET /api/v1/digital-menus - Listar cartas (ADMIN/USER/VIEWER)
GET /api/v1/digital-menus/:id - Obtener carta (ADMIN/USER/VIEWER)
GET /api/v1/digital-menus/slug/:slug - Obtener por slug (público)
PUT /api/v1/digital-menus/:id - Actualizar carta (ADMIN)
DELETE /api/v1/digital-menus/:id - Eliminar carta (ADMIN)
POST /api/v1/digital-menus/:id/clone - Clonar carta (ADMIN)
```

**Características:**

- Creación de cartas digitales con branding personalizado
- Configuración de fechas de vigencia
- Activación/desactivación de cartas
- Clonación de cartas existentes
- Slug amigable para URLs

### 2. Sistema de Códigos QR

**Endpoints:**

```http
POST /api/v1/digital-menus/:id/qr-code - Generar QR (ADMIN/USER)
GET /api/v1/digital-menus/:id/qr-code - Obtener QR (ADMIN/USER/VIEWER)
```

**Configuración de QR:**

```typescript
interface QRCodeConfig {
  qrType: 'dynamic' | 'static' | 'temporary';
  format: 'svg' | 'png' | 'jpeg' | 'webp';
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  size: number; // 100-1000px
  foregroundColor: string; // Hex
  backgroundColor: string; // Hex
  opacity?: number; // 0-1
}
```

**Niveles de Corrección de Error:**

| Nivel | Capacidad de Corrección | Uso Recomendado |
|-------|------------------------|-----------------|
| L | ~7% | Espacios limpios, impresión de alta calidad |
| M | ~15% | Entornos generales |
| Q | ~25% | Ambientes con algo de deterioro |
| H | ~30% | Ambientes adversos, impresión baja calidad |

### 3. Sistema Multi-Idioma

**Idiomas Disponibles:**

```typescript
enum MenuLanguage {
  ES = 'es',  // Español
  EN = 'en',  // Inglés
  FR = 'fr',  // Francés
  DE = 'de',  // Alemán
  IT = 'it',  // Italiano
  PT = 'pt',  // Portugués
  CA = 'ca',  // Catalán
  EU = 'eu',  // Euskera
  GL = 'gl',  // Gallego
}
```

**Configuración:**

```typescript
interface MultiLanguageConfig {
  availableLanguages: MenuLanguage[];
  defaultLanguage: MenuLanguage;
  autoDetect: boolean;
  enableLanguageSwitcher: boolean;
}
```

**Detección Automática de Idioma:**

```typescript
function detectLanguage(acceptLanguage: string): MenuLanguage {
  const supported = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ca', 'eu', 'gl'];

  for (const lang of acceptLanguage.split(',')) {
    const primary = lang.split('-')[0].toLowerCase();
    if (supported.includes(primary)) {
      return primary as MenuLanguage;
    }
  }

  return MenuLanguage.ES; // Default
}
```

### 4. Filtros de Alérgenos

**Configuración:**

```typescript
interface AllergenFilterConfig {
  enableFilters: boolean;
  availableAllergens: string[];
  showIcons: boolean;
  enableMultipleSelection: boolean;
  filterPosition: 'top' | 'bottom' | 'side';
}
```

**Alérgenos Soportados (UE 1169/2011):**

1. Gluten
2. Crustáceos
3. Huevos
4. Pescado
5. Cacahuetes
6. Soja
7. Leche
8. Frutos de cáscara
9. Apio
10. Mostaza
11. Sésamo
12. Dióxido de azufre
13. Altramuces
14. Moluscos

**Lógica de Filtrado:**

```typescript
function filterMenuItems(
  items: MenuItem[],
  selectedAllergens: string[]
): MenuItem[] {
  return items.filter((item) => {
    if (selectedAllergens.length === 0) return true;

    const hasSelectedAllergen = selectedAllergens.some((allergen) =>
      item.allergens.includes(allergen)
    );

    return !hasSelectedAllergen;
  });
}
```

### 5. Sistema de Analytics

**Endpoints:**

```http
POST /api/v1/digital-menus/analytics/view - Track vista (público)
POST /api/v1/digital-menus/analytics/interaction - Track interacción (público)
GET /api/v1/digital-menus/:id/analytics - Obtener analytics (ADMIN/USER/VIEWER)
```

**Tipos de Interacción:**

```typescript
enum InteractionType {
  VIEW_ITEM = 'view_item',
  FILTER_CLICK = 'filter_click',
  LANGUAGE_CHANGE = 'language_change',
  CATEGORY_EXPAND = 'category_expand',
}
```

**Métricas Disponibles:**

- Total de vistas
- Total de interacciones
- Vistas por idioma
- Interacciones por tipo
- Items más vistos
- Tasa de interacción (interacciones/vista)

**Cálculo de Analytics:**

```typescript
async function getMenuAnalytics(
  menuId: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsSummary> {
  const views = await countMenuViews(menuId, startDate, endDate);
  const interactions = await countMenuInteractions(menuId, startDate, endDate);
  const viewsByLanguage = await groupViewsByLanguage(menuId, startDate, endDate);
  const interactionsByType = await groupInteractionsByType(menuId, startDate, endDate);
  const mostViewedItems = await getMostViewedItems(menuId, startDate, endDate, 10);

  return {
    views,
    interactions,
    viewsByLanguage,
    interactionsByType,
    mostViewedItems,
    interactionRate: interactions / views,
  };
}
```

## Branding Personalizado

### Configuración de Branding

```typescript
interface MenuBranding {
  logoUrl: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number; // 12-32
  customCSS?: string;
}
```

### Variables CSS Dinámicas

```css
:root {
  --primary-color: {primaryColor};
  --secondary-color: {secondaryColor};
  --accent-color: {accentColor};
  --background-color: {backgroundColor};
  --text-color: {textColor};
  --font-family: {fontFamily};
  --font-size: {fontSize}px;
}
```

### Landing Page Config

```typescript
interface LandingPageConfig {
  title: string;
  subtitle?: string;
  welcomeMessage?: string;
  showLogo: boolean;
  showSocialLinks: boolean;
  socialLinks?: string[];
  enableSearch: boolean;
  enableFavoriting: boolean;
}
```

## Landing Page Pública

### Estructura

```typescript
// /menu/[slug]/page.tsx
interface LandingPageProps {
  params: { slug: string };
  searchParams: { language?: string };
}
```

### Responsividad

```css
@media (max-width: 640px) {
  .menu-grid {
    grid-template-columns: 1fr;
  }
  .filter-section {
    position: sticky;
    bottom: 0;
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .menu-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1025px) {
  .menu-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Rendimiento

- **Imágenes optimizadas**: Next.js Image Component
- **Lazy loading**: Carga diferida de items
- **Caching**: Cache de cartas traducidas (5 min)
- **CDN**: Distribución global de recursos estáticos

## Seguridad

### Protección de Endpoints

| Endpoint | Roles | Auth Required |
|----------|-------|---------------|
| POST /digital-menus | ADMIN | Yes |
| GET /digital-menus | ADMIN/USER/VIEWER | Yes |
| GET /digital-menus/:id | ADMIN/USER/VIEWER | Yes |
| GET /digital-menus/slug/:slug | PUBLIC | No |
| POST /digital-menus/analytics/view | PUBLIC | No |
| POST /digital-menus/analytics/interaction | PUBLIC | No |

### Sanitización de URLs

```typescript
function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]{3,50}$/;
  return slugRegex.test(slug);
}
```

### Rate Limiting

- **Vistas**: 10 por IP por minuto
- **Interacciones**: 20 por IP por minuto
- **Generación QR**: 5 por usuario por hora

## Integraciones

### Con Sistema de Menús

```typescript
interface MenuIntegration {
  syncCategories: (menuId: string) => Promise<void>;
  syncItems: (menuId: string) => Promise<void>;
  updateAllergens: (menuId: string) => Promise<void>;
}
```

### Con Sistema de Alérgenos

```typescript
interface AllergenIntegration {
  getAllergensForItem: (itemId: string) => Promise<string[]>;
  calculateAllergensForRecipe: (recipeId: string) => Promise<string[]>;
}
```

## Performance

### Métricas Objetivo

- **Carga inicial**: < 2s
- **Tiempo a interactuable**: < 3s
- **Lighthouse Score**: > 90
- **Tamaño inicial**: < 200KB gzipped

### Optimizaciones

1. **Code splitting**: Lazy loading de componentes
2. **Tree shaking**: Eliminar código no utilizado
3. **Image optimization**: WebP con fallback
4. **Caching agresivo**: ETag, Last-Modified
5. **Minificación**: JS y CSS

## Documentación API

### DTOs Completos

Ver `backend/src/modules/digital-menu/dto/digital-menu.dto.ts` para todas las definiciones de DTOs y validaciones.

### Ejemplos de Request

**Crear carta digital:**

```json
{
  "name": "Carta Principal",
  "tenantId": "uuid-tenant-id",
  "description": "Carta del restaurante",
  "categories": ["cat-1", "cat-2", "cat-3"],
  "isActive": true,
  "branding": {
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4",
    "backgroundColor": "#FFFFFF",
    "textColor": "#333333",
    "fontFamily": "Inter",
    "fontSize": 16
  },
  "allergenFilters": {
    "enableFilters": true,
    "availableAllergens": ["gluten", "huevos", "leche"],
    "showIcons": true,
    "enableMultipleSelection": true,
    "filterPosition": "top"
  },
  "multiLanguage": {
    "availableLanguages": ["es", "en", "fr"],
    "defaultLanguage": "es",
    "autoDetect": true,
    "enableLanguageSwitcher": true
  }
}
```

**Generar QR code:**

```json
{
  "menuId": "uuid-menu-id",
  "config": {
    "qrType": "dynamic",
    "format": "png",
    "errorCorrection": "H",
    "size": 300,
    "foregroundColor": "#000000",
    "backgroundColor": "#FFFFFF"
  }
}
```

## Checklist de Implementación

### Backend ✅
- [x] DTOs y validaciones completas
- [x] Servicio de gestión de cartas
- [x] Generación de códigos QR
- [x] Sistema de multi-idioma
- [x] Filtros de alérgenos
- [x] Tracking de analytics
- [x] Controlador REST API

### Frontend ✅
- [x] Dashboard de gestión
- [x] Multi-step con 5 módulos
- [x] Generador de QR
- [x] Gestor de traducciones
- [x] Configurador de filtros
- [x] Vista de analytics

### Pendiente
- [ ] Landing page pública
- [ ] Integración con sistema de menús existente
- [ ] Integración con sistema de alérgenos

---

**Versión**: 1.0.0
**Última actualización**: 2026-05-31
**Estado**: ✅ Implementado
**Sprint**: 11 - Carta Digital QR