# Multi-Lingual Menu System - ChefChek

## Sistema Multi-idioma para Menús y Cartas

ChefChek implementa un sistema completo de multi-idioma para menús y cartas digitales, permitiendo traducciones completas, detección automática de idioma del navegador y gestión de progreso de traducción.

## Arquitectura del Sistema

### Estructura de Traducciones

```typescript
interface MenuTranslation {
  id: string;
  menuId: string;
  language: string; // 'es', 'en', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja'
  name: string;
  description: string;
  sectionsTranslations: Json; // Map sectionId -> translated name
  itemTranslations?: Json; // Map itemId -> translated name
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### Idiomas Soportados

```typescript
const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'zh', name: '中文', flag: '🇨🇳', nativeName: '中文' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', nativeName: '日本語' },
];
```

## Implementación Frontend

### 1. Hook de Traducciones

```typescript
import { useState, useEffect } from 'react';

function useMenuTranslations(menu: Menu, initialLanguage?: string) {
  const [language, setLanguage] = useState(initialLanguage || 'es');
  const [translatedMenu, setTranslatedMenu] = useState<Menu>(menu);

  useEffect(() => {
    const translated = translateMenu(menu, language);
    setTranslatedMenu(translated);
  }, [menu, language]);

  const changeLanguage = (newLanguage: string) => {
    setLanguage(newLanguage);
  };

  return {
    language,
    setLanguage: changeLanguage,
    translatedMenu,
  };
}

function translateMenu(menu: Menu, language: string): Menu {
  const translation = menu.translations?.find(t => t.language === language);

  if (!translation) {
    return menu;
  }

  return {
    ...menu,
    name: translation.name,
    description: translation.description,
    sections: menu.sections.map(section => {
      const translatedSectionName = translation.sectionsTranslations?.[section.id] || section.name;

      return {
        ...section,
        name: translatedSectionName,
        items: section.items.map(item => {
          const translatedItemName = translation.itemTranslations?.[item.id] || item.recipeName;

          return {
            ...item,
            recipeName: translatedItemName,
          };
        }),
      };
    }),
  };
}
```

### 2. Selector de Idioma

```typescript
function LanguageSelector({ 
  languages, 
  current, 
  onChange 
}: LanguageSelectorProps) {
  return (
    <div className="relative">
      <button
        onClick={() => {}}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        <span className="text-2xl">
          {languages.find(l => l.language === current)?.flag || '🌐'}
        </span>
        <span className="text-sm font-medium text-gray-700">
          {languages.find(l => l.language === current)?.nativeName || current.toUpperCase()}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown con idiomas disponibles */}
      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-10">
        {languages.map(lang => (
          <button
            key={lang.language}
            onClick={() => onChange(lang.language)}
            className={`w-full text-left px-4 py-2 flex items-center space-x-3 hover:bg-gray-50 ${
              current === lang.language ? 'bg-indigo-50' : ''
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <div>
              <div className="text-sm font-medium">{lang.nativeName}</div>
              <div className="text-xs text-gray-500">{lang.name}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 3. Detección Automática de Idioma

```typescript
function AutoLanguageDetector({ onDetect }: AutoLanguageDetectorProps) {
  useEffect(() => {
    // Detectar idioma del navegador
    const browserLanguage = navigator.language.split('-')[0];
    
    // Verificar si el idioma detectado está soportado
    const isSupported = SUPPORTED_LANGUAGES.some(
      lang => lang.code === browserLanguage
    );

    if (isSupported) {
      onDetect(browserLanguage);
    }
  }, [onDetect]);

  return null;
}

// Uso en componente principal
<DigitalMenuPage>
  <AutoLanguageDetector onDetect={(lang) => setLanguage(lang)} />
  {/* ... resto del componente */}
</DigitalMenuPage>
```

## Backend Multi-idioma

### 1. Validación de Traducciones

```typescript
import { IsEnum, IsString, IsOptional } from 'class-validator';

enum SupportedLanguage {
  ES = 'es',
  EN = 'en',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  RU = 'ru',
  ZH = 'zh',
  JA = 'ja',
}

export class CreateMenuTranslationDto {
  @IsEnum(SupportedLanguage)
  language: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  sectionsTranslations?: Record<string, string>;
}
```

### 2. Gestión de Traducciones

```typescript
async updateMenuTranslations(menuId: string, translations: MenuTranslationDto[]): Promise<void> {
  // Eliminar traducciones existentes
  await this.prisma.menuTranslation.deleteMany({ where: { menuId } });

  // Crear nuevas traducciones
  for (const translation of translations) {
    await this.prisma.menuTranslation.create({
      data: {
        menuId,
        language: translation.language,
        name: translation.name,
        description: translation.description,
        sectionsTranslations: translation.sectionsTranslations || {},
      },
    });
  }

  // Invalidar cache de traducciones
  this.translationCache.invalidate(menuId);
}
```

### 3. Endpoint de Traducciones

```typescript
@Get(':id/translations/:language')
async getTranslation(
  @Req() req,
  @Param('id') id: string,
  @Param('language') language: string
) {
  const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
  const menu = await this.findOne(tenantId, id);

  const translation = menu.translations?.find(t => t.language === language);

  if (!translation) {
    // Retornar menú original si no hay traducción
    return {
      success: true,
      data: menu,
      isTranslated: false,
      language: menu.name, // nombre del menú como fallback
      message: 'Translation not found, returning original menu',
    };
  }

  return {
    success: true,
    data: this.translateMenu(menu, language),
    isTranslated: true,
    language,
    message: 'Menu retrieved in selected language',
  };
}
```

## Sistema de Validación de Traducciones

### 1. Verificación de Completitud

```typescript
interface TranslationCompleteness {
  menuId: string;
  totalLanguages: number;
  completedLanguages: number;
  incompleteLanguages: string[];
  missingFields: Record<string, string[]>;
}

async checkTranslationCompleteness(menuId: string): Promise<TranslationCompleteness> {
  const menu = await this.prisma.menu.findUnique({
    where: { id: menuId },
    include: { translations: true },
  });

  const totalLanguages = SUPPORTED_LANGUAGES.length;
  const completedLanguages = menu.translations?.length || 0;
  const incompleteLanguages: string[] = [];

  // Verificar idiomas soportados sin traducción
  SUPPORTED_LANGUAGES.forEach(lang => {
    const hasTranslation = menu.translations?.some(t => t.language === lang.code);
    if (!hasTranslation) {
      incompleteLanguages.push(lang.code);
    }
  });

  // Verificar campos faltantes en traducciones
  const missingFields: Record<string, string[]> = {};

  menu.translations?.forEach(translation => {
    const missing: string[] = [];

    if (!translation.name) missing.push('name');
    if (!translation.description) missing.push('description');
    if (!translation.sectionsTranslations || Object.keys(translation.sectionsTranslations).length === 0) {
      missing.push('sectionsTranslations');
    }

    if (missing.length > 0) {
      missingFields[translation.language] = missing;
    }
  });

  return {
    menuId,
    totalLanguages,
    completedLanguages,
    incompleteLanguages,
    missingFields,
  };
}
```

### 2. Dashboard de Progreso de Traducción

```typescript
async getTranslationProgress(tenantId: string): Promise<TranslationProgressReport> {
  const menus = await this.prisma.menu.findMany({
    where: { tenantId, isActive: true },
    include: { translations: true },
  });

  const totalMenus = menus.length;
  const totalTranslations = menus.reduce((sum, menu) => sum + (menu.translations?.length || 0), 0);
  const requiredTranslations = totalMenus * SUPPORTED_LANGUAGES.length;

  const byLanguage: Record<string, number> = {};
  SUPPORTED_LANGUAGES.forEach(lang => {
    byLanguage[lang.code] = menus.filter(menu =>
      menu.translations?.some(t => t.language === lang.code)
    ).length;
  });

  const completionPercentage = requiredTranslations > 0
    ? (totalTranslations / requiredTranslations) * 100
    : 0;

  return {
    totalMenus,
    totalTranslations,
    requiredTranslations,
    completionPercentage,
    byLanguage,
  };
}
```

## Integración con Recetas Multi-idioma

### 1. Traducciones de Recetas en Menús

```typescript
interface MenuItemWithTranslations extends MenuItem {
  recipe: {
    id: string;
    name: string;
    translations?: RecipeTranslation[];
  };
}

function getTranslatedRecipeName(
  item: MenuItemWithTranslations,
  language: string
): string {
  const recipeTranslation = item.recipe.translations?.find(
    t => t.language === language
  );

  if (recipeTranslation?.name) {
    return recipeTranslation.name;
  }

  // Fallback al nombre original
  return item.recipeName || item.recipe.name;
}
```

### 2. Mapeo Completo de Traducciones

```typescript
function translateCompleteMenu(menu: Menu, language: string): TranslatedMenu {
  const translation = menu.translations?.find(t => t.language === language);

  return {
    ...menu,
    name: translation?.name || menu.name,
    description: translation?.description || menu.description,
    sections: menu.sections.map(section => {
      const sectionName = translation?.sectionsTranslations?.[section.id] || section.name;

      return {
        ...section,
        name: sectionName,
        items: section.items.map(item => {
          const recipeTranslation = item.recipe.translations?.find(
            t => t.language === language
          );

          const itemName = recipeTranslation?.name || item.recipeName;
          const itemDescription = recipeTranslation?.description || item.recipeDescription;

          return {
            ...item,
            recipeName: itemName,
            recipeDescription: itemDescription,
          };
        }),
      };
    }),
  };
}
```

## Caché de Traducciones

### 1. Sistema de Cache

```typescript
class TranslationCache {
  private cache: Map<string, TranslatedMenu>;
  private ttl: number; // Time to live en segundos

  constructor(ttl: number = 3600) { // 1 hora por defecto
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key: string, translatedMenu: TranslatedMenu): void {
    this.cache.set(key, {
      data: translatedMenu,
      expires: Date.now() + this.ttl * 1000,
    });
  }

  get(key: string): TranslatedMenu | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  invalidate(menuId: string): void {
    // Eliminar todas las traducciones de este menú
    const keysToDelete: string[] = [];

    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${menuId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}
```

### 2. Uso en Servicio

```typescript
@Injectable()
export class MenusService {
  private translationCache = new TranslationCache();

  async getTranslatedMenu(menuId: string, language: string): Promise<TranslatedMenu> {
    const cacheKey = `${menuId}:${language}`;

    // Verificar cache
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Cargar menú desde DB
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: {
                  include: {
                    translations: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        translations: true,
      },
    });

    const translated = this.translateCompleteMenu(menu, language);

    // Guardar en cache
    this.translationCache.set(cacheKey, translated);

    return translated;
  }
}
```

## Validaciones y Seguridad

### 1. Validación de Idiomas Soportados

```typescript
export class SupportedLanguageValidator {
  constructor(private readonly supportedLanguages: string[]) {}

  validate(language: string): boolean {
    return this.supportedLanguages.includes(language);
  }
}

// Uso en DTO
export class CreateMenuTranslationDto {
  @IsString()
  @Matches(/^(es|en|fr|de|it|pt|ru|zh|ja)$/)
  language: string;

  // ... otros campos
}
```

### 2. Sanitización de Traducciones

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeTranslation(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
  });
}

async updateMenuTranslation(menuId: string, translation: MenuTranslationDto): Promise<void> {
  const sanitizedTranslation = {
    ...translation,
    name: sanitizeTranslation(translation.name),
    description: translation.description ? sanitizeTranslation(translation.description) : undefined,
  };

  // ... resto de la implementación
}
```

## Testing Multi-idioma

### 1. Tests Unitarios

```typescript
describe('Multi-Lingual Menu System', () => {
  it('should translate menu to English', async () => {
    const menu = await createMenuWithTranslations();

    const translatedMenu = await menusService.getTranslatedMenu(
      menu.id,
      'en'
    );

    expect(translatedMenu.name).toBe('Executive Menu');
    expect(translatedMenu.sections[0].name).toBe('Starters');
    expect(translatedMenu.sections[0].items[0].recipeName).toBe('Tomato Soup');
  });

  it('should fallback to original if translation missing', async () => {
    const menu = await createMenuWithoutTranslations();

    const translatedMenu = await menusService.getTranslatedMenu(
      menu.id,
      'fr'
    );

    expect(translatedMenu.name).toBe(menu.name);
    expect(translatedMenu.sections[0].name).toBe(menu.sections[0].name);
  });

  it('should validate supported languages', async () => {
    const invalidLanguage = 'xyz';

    await expect(
      menusService.createTranslation(menuId, {
        language: invalidLanguage,
        name: 'Test',
      })
    ).rejects.toThrow('Language not supported');
  });
});
```

## Documentación Relacionada

- [Menu Composition System](./menu-composition-system.md) - Sistema de composición de menús
- [Digital Menu Architecture](./digital-menu-architecture.md) - Arquitectura de cartas digitales
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful