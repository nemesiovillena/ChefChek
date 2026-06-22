# Digital Menu Architecture - ChefChek

## Arquitectura de Cartas Digitales

ChefChek implementa un sistema completo de cartas digitales QR con branding personalizado, filtros de alérgenos en tiempo real y experiencia multi-idioma.

## Arquitectura del Sistema

### Componentes Principales

```
Carta Digital QR
├── Landing Page Responsive
│   ├── Header con Branding
│   ├── Navegación por Secciones
│   ├── Filtros de Alérgenos
│   └── Lista de Platos
├── Sistema QR
│   ├── Generación Automática
│   ├── URLs Únicas por Menú
│   └── Tracking de Uso
├── Branding Personalizado
│   ├── Colores y Logo
│   ├── Tipografía
│   └── Layout Personalizado
└── Analytics
    ├── Vistas por Platos
    ├── Filtros Usados
    └── Métricas de Interacción
```

### Flujo de Usuario

```
1. Escanear QR Code
   ↓
2. Landing Page Responsive
   ↓
3. Selección de Idioma
   ↓
4. Aplicar Filtros de Alérgenos
   ↓
5. Navegar por Secciones
   ↓
6. Ver Detalles del Plato
   ↓
7. Ver Información Alérgenos
```

## Generación de QR Codes

### 1. Sistema de QR Codes Únicos

```typescript
interface QRCodeGeneration {
  menuId: string;
  menuUrl: string;
  qrCodeUrl: string;
  expiresAt?: Date;
}

async generateQRCode(tenantId: string, menuId: string): Promise<QRCodeGeneration> {
  // Validar menú existe y está activo
  const menu = await this.prisma.menu.findFirst({
    where: { id: menuId, tenantId, isActive: true },
  });

  if (!menu) {
    throw new NotFoundException('Menu not found or inactive');
  }

  // Generar URL única
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const menuUrl = `${baseUrl}/menu/${menuId}`;

  // Generar QR code usando API externa
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

  return {
    menuId,
    menuUrl,
    qrCodeUrl,
  };
}
```

### 2. QR Codes con Tiempo de Expiración

```typescript
async generateExpiringQRCode(
  tenantId: string,
  menuId: string,
  expiresIn: number = 24 // horas
): Promise<QRCodeGeneration> {
  const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

  const { menuUrl, qrCodeUrl } = await this.generateQRCode(tenantId, menuId);

  // Generar URL con timestamp y token
  const token = crypto.randomBytes(32).toString('hex');
  const expiringUrl = `${menuUrl}?token=${token}&expires=${expiresAt.getTime()}`;

  const expiringQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(expiringUrl)}`;

  return {
    menuId,
    menuUrl: expiringUrl,
    qrCodeUrl: expiringQrCode,
    expiresAt,
  };
}
```

## Landing Page Digital

### 1. Estructura Responsive

```typescript
// Componente LandingPage
export default function DigitalMenuPage({ params }: { params: { id: string } }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [language, setLanguage] = useState('es');
  const [selectedAllergens, setSelectedAllergens] = useState<number[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    fetchMenu(params.id);
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Logo branding={menu?.branding} />
            <LanguageSelector
              languages={menu?.translations?.map(t => t.language)}
              current={language}
              onChange={setLanguage}
            />
          </div>
        </div>
      </header>

      {/* Allergen Filters */}
      <AllergenFilters
        selected={selectedAllergens}
        onChange={setSelectedAllergens}
        language={language}
      />

      {/* Navigation */}
      <MenuNavigation
        sections={menu?.sections}
        current={activeSection}
        onChange={setActiveSection}
        language={language}
      />

      {/* Content */}
      <MenuContent
        menu={menu}
        language={language}
        selectedAllergens={selectedAllergens}
        activeSection={activeSection}
      />
    </div>
  );
}
```

### 2. Componente de Filtros de Alérgenos

```typescript
function AllergenFilters({ selected, onChange, language }: AllergenFiltersProps) {
  const allergens = [
    { id: 1, icon: '🌾', name: 'Cereales' },
    { id: 2, icon: '🦐', name: 'Crustáceos' },
    { id: 3, icon: '🥚', name: 'Huevos' },
    { id: 4, icon: '🐟', name: 'Pescado' },
    { id: 5, icon: '🥜', name: 'Cacahuetes' },
    { id: 6, icon: '🫘', name: 'Soya' },
    { id: 7, icon: '🥛', name: 'Leche' },
    { id: 8, icon: '🥬', name: 'Apio' },
    { id: 9, icon: '🌭', name: 'Mostaza' },
    { id: 10, icon: '🥜', name: 'Sésamo' },
    { id: 11, icon: '🍷', name: 'Sulfitos' },
    { id: 12, icon: '🌱', name: 'Altramuces' },
    { id: 13, icon: '🐚', name: 'Moluscos' },
    { id: 14, icon: '🌭', name: 'Mostaza' },
  ];

  return (
    <div className="bg-gray-100 py-3 px-4 overflow-x-auto">
      <div className="flex space-x-2">
        {allergens.map((allergen) => {
          const isSelected = selected.includes(allergen.id);
          return (
            <button
              key={allergen.id}
              onClick={() => {
                if (isSelected) {
                  onChange(selected.filter(id => id !== allergen.id));
                } else {
                  onChange([...selected, allergen.id]);
                }
              }}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                isSelected
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {allergen.icon} {allergen.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### 3. Componente de Contenido de Menú

```typescript
function MenuContent({ menu, language, selectedAllergens, activeSection }: MenuContentProps) {
  const translations = menu.translations?.find(t => t.language === language);

  const filterByAllergens = (items: MenuItem[]) => {
    if (selectedAllergens.length === 0) return items;

    return items.filter(item => {
      const recipeAllergens = item.allergens || [];
      return !selectedAllergens.some(id => recipeAllergens.includes(id));
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {translations?.name || menu.name}
      </h1>
      {translations?.description && (
        <p className="text-gray-600 mb-8">{translations.description}</p>
      )}

      <div className="space-y-12">
        {menu.sections.map((section) => {
          const sectionName = translations?.sectionsTranslations?.[section.id] || section.name;
          const filteredItems = filterByAllergens(section.items);

          if (filteredItems.length === 0) return null;

          return (
            <div key={section.id} id={`section-${section.id}`}>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                {sectionName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    language={language}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Branding Personalizado

### 1. Sistema de Configuración de Branding

```typescript
interface BrandingSettings {
  primaryColor: string;        // Color principal (buttons, highlights)
  secondaryColor: string;      // Color secundario (accents)
  backgroundColor: string;     // Color de fondo
  textColor: string;           // Color de texto principal
  logoUrl?: string;             // URL del logo
  fontFamily?: string;          // Fuente personalizada
  customCss?: string;           // CSS personalizado
}

interface MenuWithBranding extends Menu {
  branding?: BrandingSettings;
}
```

### 2. Aplicación de Branding

```typescript
function DigitalMenuPage({ params }: { params: { id: string } }) {
  const [menu, setMenu] = useState<MenuWithBranding | null>(null);

  // Aplicar branding personalizado
  useEffect(() => {
    if (menu?.branding) {
      document.documentElement.style.setProperty('--primary-color', menu.branding.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', menu.branding.secondaryColor);
      document.documentElement.style.setProperty('--background-color', menu.branding.backgroundColor);
    }
  }, [menu]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: menu?.branding?.backgroundColor }}>
      <header style={{ backgroundColor: menu?.branding?.primaryColor }}>
        {menu?.branding?.logoUrl && (
          <img src={menu.branding.logoUrl} alt="Logo" className="h-12" />
        )}
      </header>
    </div>
  );
}
```

## Analytics de Uso

### 1. Tracking de Interacciones

```typescript
interface MenuAnalytics {
  menuId: string;
  totalViews: number;
  sectionViews: Record<string, number>;
  itemViews: Record<string, number>;
  allergenFilters: Record<number, number>;
  languagesUsed: Record<string, number>;
  lastViewedAt: Date;
}

async trackMenuView(menuId: string, metadata: TrackMetadata): Promise<void> {
  await this.prisma.menuAnalytics.create({
    data: {
      menuId,
      language: metadata.language,
      allergenFilters: metadata.allergenFilters || [],
      timestamp: new Date(),
    },
  });
}
```

### 2. Dashboard de Analytics

```typescript
async getMenuAnalytics(menuId: string): Promise<MenuAnalytics> {
  const analytics = await this.prisma.menuAnalytics.findMany({
    where: { menuId },
    orderBy: { timestamp: 'desc' },
  });

  const sectionViews = new Map<string, number>();
  const itemViews = new Map<string, number>();
  const allergenFilters = new Map<number, number>();
  const languagesUsed = new Map<string, number>();

  analytics.forEach(a => {
    // Contar vistas por sección
    a.sectionViews?.forEach((count, sectionId) => {
      sectionViews.set(sectionId, (sectionViews.get(sectionId) || 0) + count);
    });

    // Contar vistas por item
    a.itemView?.forEach((count, itemId) => {
      itemViews.set(itemId, (itemViews.get(itemId) || 0) + count);
    });

    // Contar filtros de alérgenos
    a.allergenFilters.forEach(allergenId => {
      allergenFilters.set(allergenId, (allergenFilters.get(allergenId) || 0) + 1);
    });

    // Contar idiomas usados
    languagesUsed.set(a.language, (languagesUsed.get(a.language) || 0) + 1);
  });

  return {
    menuId,
    totalViews: analytics.length,
    sectionViews: Object.fromEntries(sectionViews),
    itemViews: Object.fromEntries(itemViews),
    allergenFilters: Object.fromEntries(allergenFilters),
    languagesUsed: Object.fromEntries(languagesUsed),
    lastViewedAt: analytics[0]?.timestamp,
  };
}
```

## Optimización de Performance

### 1. Carga Progresiva de Contenido

```typescript
async loadMenuWithProgressiveLoading(menuId: string): Promise<Menu> {
  // Cargar datos básicos primero
  const basicData = await this.prisma.menu.findUnique({
    where: { id: menuId },
    select: {
      id: true,
      name: true,
      description: true,
      translations: true,
    },
  });

  // Cargar secciones y items después
  const detailedData = await this.prisma.menu.findUnique({
    where: { id: menuId },
    include: {
      sections: {
        include: {
          items: {
            include: {
              recipe: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    },
  });

  return { ...basicData, ...detailedData };
}
```

### 2. Cache de Landing Pages

```typescript
const menuPageCache = new Map<string, { data: Menu; expires: number }>();

async getCachedMenuPage(menuId: string): Promise<Menu | null> {
  const cached = menuPageCache.get(menuId);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const menu = await this.loadMenuWithProgressiveLoading(menuId);
  
  if (menu) {
    menuPageCache.set(menuId, {
      data: menu,
      expires: Date.now() + 3600000, // 1 hora
    });
  }

  return menu;
}
```

## Documentación Relacionada

- [Menu Composition System](./menu-composition-system.md) - Sistema de composición de menús
- [Multi-Lingual Menu System](./multi-lingual-menu-system.md) - Sistema multi-idioma
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Digital Menu Architecture](./digital-menu-architecture.md) - Arquitectura de cartas digitales (este archivo)
- [Recursive Recipe System](./recursive-recipe-system.md) - Sistema de recetas recursivas