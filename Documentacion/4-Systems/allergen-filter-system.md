# Sistema de Filtros de Alérgenos

## Resumen

Sistema de filtrado de alérgenos en tiempo real para cartas digitales. Permite a los clientes filtrar items del menú según sus alérgenos o intolerancias, cumpliendo con el Reglamento UE 1169/2011 sobre información alimentaria.

## Normativa de Alérgenos (UE 1169/2011)

### Alérgenos Obligatorios

Los siguientes 14 alérgenos deben ser declarados obligatoriamente en toda la Unión Europea:

| ID | Alérgeno | Símbolo | Descripción |
|----|----------|---------|-------------|
| 1 | Gluten | 🌾 | Trigo, centeno, cebada, avena |
| 2 | Crustáceos | 🦐 | Gambas, langostinos, cangrejos |
| 3 | Huevos | 🥚 | Todos los productos de huevo |
| 4 | Pescado | 🐟 | Todos los pescados |
| 5 | Cacahuetes | 🥜 | Cacahuetes y productos |
| 6 | Soja | 🌱 | Soja y derivados |
| 7 | Leche | 🥛 | Leche y productos lácteos |
| 8 | Frutos de cáscara | 🥜 | Almendras, nueces, avellanas |
| 9 | Apio | 🥬 | Apio y derivados |
| 10 | Mostaza | 🌿 | Mostaza y productos |
| 11 | Sésamo | 🫘 | Sésamo y derivados |
| 12 | Dióxido de azufre | 💨 | Sulfitos por encima de 10mg/kg |
| 13 | Altramuces | 🌰 | Altramuces y productos |
| 14 | Moluscos | 🦪 | Mejillones, almejas, ostras |

## Arquitectura del Sistema

### Flujo de Filtrado

```
1. Carga de Carta
   ├── Obtiene items del menú
   ├── Carga alérgenos de cada item
   └── Aplica traducciones de idioma

2. Selección de Filtros
   ├── Usuario selecciona alérgenos
   ├── Actualiza estado de filtros
   └── Aplica lógica de filtrado

3. Filtrado en Tiempo Real
   ├── Filtra items con alérgenos seleccionados
   ├── Actualiza vista de menú
   └── Muestra resultados filtrados

4. Feedback Visual
   ├── Muestra items filtrados
   ├── Resalta alérgenos en items restantes
   └── Muestra mensaje de sin resultados

5. Tracking de Analytics
   ├── Registra clics en filtros
   ├── Track combinaciones populares
   └── Métricas de uso
```

### Lógica de Filtrado

```typescript
interface FilterOptions {
  selectedAllergens: string[];
  mode: 'exclude' | 'include'; // Exclude: items SIN alérgenos, Include: items CON alérgenos
  strict: boolean; // Strict: todos los alérgenos, Relaxed: cualquiera de los alérgenos
}

function filterMenuItems(
  items: MenuItem[],
  options: FilterOptions
): MenuItem[] {
  const { selectedAllergens, mode, strict } = options;

  if (selectedAllergens.length === 0) {
    return items; // Sin filtros aplicados
  }

  return items.filter((item) => {
    const itemAllergens = item.allergens || [];

    if (mode === 'exclude') {
      // Excluir items con cualquier alérgeno seleccionado
      return strict
        ? !selectedAllergens.some((a) => itemAllergens.includes(a))
        : !selectedAllergens.every((a) => itemAllergens.includes(a));
    } else {
      // Incluir solo items con alérgenos seleccionados
      return strict
        ? selectedAllergens.every((a) => itemAllergens.includes(a))
        : selectedAllergens.some((a) => itemAllergens.includes(a));
    }
  });
}
```

## Configuración de Filtros

### Configuración Global

```typescript
interface AllergenFilterConfig {
  enableFilters: boolean;
  availableAllergens: string[];
  showIcons: boolean;
  enableMultipleSelection: boolean;
  filterPosition: 'top' | 'bottom' | 'side';
  defaultMode: 'exclude' | 'include';
  defaultStrict: boolean;
  showAllergenInfo: boolean;
}
```

### Configuración por Carta

```typescript
interface MenuAllergenConfig {
  menuId: string;
  filters: AllergenFilterConfig;
  allergenMapping: Record<string, string>; // Mapping de alérgenos internos a alérgenos UE
  customAllergens?: string[]; // Alérgenos adicionales específicos del restaurante
}
```

## Componentes UI

### Selector de Filtros

```typescript
interface AllergenFilterSelectorProps {
  availableAllergens: string[];
  selectedAllergens: string[];
  showIcons: boolean;
  enableMultipleSelection: boolean;
  onAllergenToggle: (allergen: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}
```

**Características:**

- Toggle para cada alérgeno disponible
- Icono visual para cada alérgeno
- Selección múltiple si habilitado
- Botón "Seleccionar todos"
- Botón "Limpiar selección"
- Badge con cantidad de filtros activos

### Vista de Resultados Filtrados

```typescript
interface FilteredMenuViewProps {
  items: MenuItem[];
  filters: string[];
  totalItems: number;
  filteredCount: number;
  onFilterRemove: (allergen: string) => void;
}
```

**Características:**

- Contador de items filtrados
- Lista de filtros activos con botón de eliminar
- Mensaje cuando no hay resultados
- Botón para limpiar todos los filtros
- Highlight de alérgenos en items restantes

### Badge de Alérgenos en Items

```typescript
interface AllergenBadgeProps {
  allergens: string[];
  showIcon: boolean;
  compact?: boolean;
  onClick?: (allergen: string) => void;
}
```

**Estilos:**

- Badge compacto: icono + abreviatura
- Badge completo: icono + nombre completo
- Badge interactivo: clickable para filtrar
- Colores diferenciados por alérgeno

## Propagación de Alérgenos

### Cálculo de Alérgenos en Recetas

```typescript
async function calculateAllergensForRecipe(recipeId: string): Promise<string[]> {
  const recipe = await getRecipe(recipeId);
  const ingredientAllergens = new Set<string>();

  for (const ingredient of recipe.ingredients) {
    const product = await getProduct(ingredient.productId);

    if (product.allergens) {
      product.allergens.forEach((a) => ingredientAllergens.add(a));
    }

    // Recursividad para sub-recetas
    if (ingredient.isRecipe) {
      const subRecipeAllergens = await calculateAllergensForRecipe(
        ingredient.productId
      );
      subRecipeAllergens.forEach((a) => ingredientAllergens.add(a));
    }
  }

  return Array.from(ingredientAllergens);
}
```

### Cálculo en Cascada

```
Producto -> Ingrediente -> Receta -> Menú
  ↓           ↓           ↓          ↓
Alérgenos   +           +          =
                                        Alérgenos Totales
```

### Validación de Completitud

```typescript
function validateAllergenCompleteness(
  menuId: string
): AllergenValidationResult {
  const items = getMenuItems(menuId);
  const issues: AllergenIssue[] = [];

  for (const item of items) {
    if (!item.allergens || item.allergens.length === 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        type: 'missing_allergens',
        severity: 'warning',
        message: 'Item sin alérgenos declarados',
      });
    }

    // Verificar ingredientes sub-recetas
    for (const ingredient of item.ingredients) {
      if (ingredient.isRecipe && !ingredient.allergensCalculated) {
        issues.push({
          itemId: item.id,
          itemName: item.name,
          type: 'uncalculated_recipe',
          severity: 'error',
          message: `Sub-receta ${ingredient.name} sin alérgenos calculados`,
        });
      }
    }
  }

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    errors: issues.filter((i) => i.severity === 'error').length,
  };
}
```

## Analytics de Filtros

### Métricas de Uso

```typescript
interface FilterAnalytics {
  mostUsedAllergens: {
    allergen: string;
    usageCount: number;
    percentage: number;
  }[];
  commonCombinations: {
    combination: string[];
    usageCount: number;
    percentage: number;
  }[];
  filterUsageByLanguage: {
    language: string;
    filterUsageRate: number; // Usuarios que usaron filtros / total usuarios
  }[];
}
```

### Tracking de Interacciones

```typescript
async function trackFilterInteraction(
  menuId: string,
  allergen: string,
  action: 'add' | 'remove' | 'clear_all'
): Promise<void> {
  await analyticsService.trackMenuInteraction({
    menuId,
    interactionType: 'filter_click',
    metadata: {
      allergen,
      action,
      timestamp: new Date().toISOString(),
    },
  });
}
```

## Mejores Prácticas

### Para Restaurantes

1. **Declaración completa**: Declarar todos los alérgenos en cada item
2. **Actualización regular**: Mantener alérgenos actualizados cuando cambian ingredientes
3. **Transparencia**: Informar sobre posibles contaminaciones cruzadas
4. **Capacitación**: Formar al personal sobre alérgenos
5. **Documentación**: Mantener registro de declaraciones

### Para Desarrolladores

1. **Validación**: Validar alérgenos antes de guardar
2. **Cálculo en cascada**: Recalcular alérgenos automáticamente
3. **UI intuitiva**: Hacer filtrado fácil de usar
4. **Feedback visual**: Mostrar claramente estado de filtros
5. **Performance**: Filtrado rápido sin lag

### Para Clientes

1. **Claridad**: Iconos y nombres claros de alérgenos
2. **Facilidad**: Filtrado con un clic
3. **Feedback**: Confirmación visual de filtros aplicados
4. **Accesibilidad**: Filtros accesibles para todos los usuarios
5. **Información**: Ayuda contextual sobre alérgenos

## Accesibilidad

### Contraste de Colores

```css
.allergen-badge {
  background-color: var(--badge-color);
  color: var(--text-color);
  min-contrast-ratio: 4.5; /* WCAG AA */
}

.allergen-badge:focus {
  outline: 3px solid var(--focus-color);
  outline-offset: 2px;
}
```

### Lectores de Pantalla

```typescript
const allergenAriaLabel = (allergen: string, selected: boolean): string => {
  const status = selected ? 'seleccionado' : 'no seleccionado';
  return `Filtro de ${allergen}, ${status}. Click para cambiar selección.`;
};
```

### Navegación por Teclado

```typescript
function AllergenFilterKeyboardNav() {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        setFocusedIndex((prev) => Math.min(prev + 1, allergens.length - 1));
        break;
      case 'ArrowUp':
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        toggleAllergen(allergens[focusedIndex]);
        break;
      case 'Escape':
        clearAllFilters();
        break;
    }
  };
}
```

## Testing

### Tests Unitarios

```typescript
describe('Allergen Filter System', () => {
  describe('filterMenuItems', () => {
    it('should exclude items with selected allergens', () => {
      const items = [
        { id: '1', name: 'Item 1', allergens: ['gluten', 'huevos'] },
        { id: '2', name: 'Item 2', allergens: ['leche'] },
        { id: '3', name: 'Item 3', allergens: [] },
      ];

      const filtered = filterMenuItems(items, {
        selectedAllergens: ['gluten'],
        mode: 'exclude',
        strict: false,
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.id)).toEqual(['2', '3']);
    });

    it('should return all items when no filters selected', () => {
      const items = [
        { id: '1', name: 'Item 1', allergens: ['gluten'] },
        { id: '2', name: 'Item 2', allergens: ['huevos'] },
      ];

      const filtered = filterMenuItems(items, {
        selectedAllergens: [],
        mode: 'exclude',
        strict: false,
      });

      expect(filtered).toHaveLength(2);
    });
  });

  describe('calculateAllergensForRecipe', () => {
    it('should propagate allergens from ingredients', async () => {
      const mockGetRecipe = jest.fn().mockResolvedValue({
        id: '1',
        ingredients: [
          { productId: 'p1', isRecipe: false },
          { productId: 'p2', isRecipe: true },
        ],
      });

      const mockGetProduct = jest.fn()
        .mockResolvedValueOnce({ allergens: ['gluten'] })
        .mockResolvedValueOnce({ allergens: ['huevos'] });

      const allergens = await calculateAllergensForRecipe('1');

      expect(allergens).toContain('gluten');
      expect(allergens).toContain('huevos');
    });
  });
});
```

### Tests de UI

```typescript
describe('AllergenFilterComponent', () => {
  it('should toggle allergen selection on click', () => {
    render(<AllergenFilterSelector />);

    const glutenButton = screen.getByLabelText(/gluten/i);
    fireEvent.click(glutenButton);

    expect(glutenButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should clear all filters on button click', () => {
    render(<AllergenFilterSelector />);

    const glutenButton = screen.getByLabelText(/gluten/i);
    fireEvent.click(glutenButton);

    const clearButton = screen.getByText(/limpiar/i);
    fireEvent.click(clearButton);

    expect(glutenButton).toHaveAttribute('aria-pressed', 'false');
  });
});
```

## Integraciones

### Con Sistema de Recetas

```typescript
interface RecipeAllergenSync {
  onRecipeUpdate: (recipeId: string) => Promise<void>;
  onIngredientUpdate: (ingredientId: string) => Promise<void>;
  batchUpdate: (recipeIds: string[]) => Promise<void>;
}
```

### Con Sistema de Analytics

```typescript
interface FilterAnalyticsIntegration {
  trackFilterUse: (menuId: string, filters: string[]) => Promise<void>;
  getFilterPopularity: (menuId: string) => Promise<FilterAnalytics>;
  exportFilterData: (menuId: string, format: 'csv' | 'json') => Promise<Blob>;
}
```

## Checklist de Implementación

### Backend ✅
- [x] Modelo de alérgenos UE 1169/2011
- [x] Sistema de propagación de alérgenos
- [x] Validación de completitud
- [x] Cálculo en cascada
- [x] Tracking de analytics

### Frontend ✅
- [x] Selector de filtros con toggles
- [x] Vista de resultados filtrados
- [x] Badge de alérgenos en items
- [x] Feedback visual de estado
- [x] Filtros en configuración de carta

### Pendiente
- [ ] Tests de UI automatizados
- [ ] Accesibilidad completa
- [ ] Exportación de datos de filtros
- [ ] Reportes de popularidad de filtros

---

**Versión**: 1.0.0
**Última actualización**: 2026-05-31
**Estado**: ✅ Implementado
**Sprint**: 11 - Carta Digital QR