# Allergen Conflict Detection System - ChefChek

## Sistema de Detección de Conflictos de Alérgenos

ChefChek implementa un sistema avanzado de detección de conflictos de alérgenos que ayuda a prevenir riesgos para personas alérgicas, identificando incompatibilidades entre filtros de usuario y la composición de menús.

## Arquitectura del Sistema

### Tipos de Conflictos

```
Conflicto de Alérgeno
├── Filtro de Usuario
│   ├── Cliente con alergia a cacahuetes [5]
│   └── Cliente con alergia a leche [7]
└── Composición del Menú
    ├── Ensalada (cacahuetes) [5] ⚠️ CONFLICTO
    └── Postre de leche [7] ⚠️ CONFLICTO

Resultado: 2 conflictos detectados, menú no seguro
```

### Niveles de Severidad

```typescript
interface ConflictSeverity {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  actionRequired: 'IMMEDIATE' | 'SOON' | 'MONITOR' | 'NONE';
  autoResolve: boolean;
}

const SEVERITY_LEVELS: Record<number, ConflictSeverity> = {
  1: { level: 'HIGH', description: 'Gluten - Celiaquia', actionRequired: 'IMMEDIATE', autoResolve: false },
  2: { level: 'HIGH', description: 'Crustáceos - Anafilaxis', actionRequired: 'IMMEDIATE', autoResolve: false },
  3: { level: 'HIGH', description: 'Huevos - Anafilaxis', actionRequired: 'IMMEDIATE', autoResolve: false },
  4: { level: 'HIGH', description: 'Pescado - Anafilaxis', actionRequired: 'IMMEDIATE', autoResolve: false },
  5: { level: 'CRITICAL', description: 'Cacahuetes - Anafilaxis severa', actionRequired: 'IMMEDIATE', autoResolve: false },
  6: { level: 'HIGH', description: 'Soja - Reacción moderada', actionRequired: 'SOON', autoResolve: false },
  7: { level: 'HIGH', description: 'Leche - Intolerancia/Alérgia', actionRequired: 'IMMEDIATE', autoResolve: false },
  8: { level: 'MEDIUM', description: 'Apio - Reacción leve', actionRequired: 'SOON', autoResolve: true },
  9: { level: 'MEDIUM', description: 'Mostaza - Reacción moderada', actionRequired: 'SOON', autoResolve: false },
  10: { level: 'MEDIUM', description: 'Sésamo - Reacción moderada', actionRequired: 'SOON', autoResolve: false },
  11: { level: 'HIGH', description: 'Sulfitos - Asma', actionRequired: 'IMMEDIATE', autoResolve: false },
  12: { level: 'MEDIUM', description: 'Altramuces - Reacción leve', actionRequired: 'SOON', autoResolve: true },
  13: { level: 'HIGH', description: 'Moluscos - Anafilaxis', actionRequired: 'IMMEDIATE', autoResolve: false },
  14: { level: 'MEDIUM', description: 'Mostaza en polvo', actionRequired: 'SOON', autoResolve: false },
};
```

## Implementación Backend

### 1. Algoritmo de Detección de Conflictos

```typescript
async detectAllergenConflicts(
  tenantId: string,
  menuId: string,
  filteredAllergens: number[]
): Promise<AllergenConflict[]> {
  const menu = await this.prisma.menu.findFirst({
    where: { id: menuId, tenantId },
    include: {
      sections: {
        include: {
          items: {
            include: {
              recipe: {
                include: {
                  ingredients: {
                    include: {
                      product: true,
                    },
                  },
                  subRecipes: {
                    include: {
                      subRecipe: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!menu) {
    throw new NotFoundException('Menu not found');
  }

  const conflicts: AllergenConflict[] = [];

  for (const section of menu.sections) {
    for (const item of section.items) {
      if (item.recipe) {
        // Calcular alérgenos de la receta si no están calculados
        const recipeAllergens = await this.calculateRecipeAllergens(item.recipe.id);

        // Encontrar conflictos con filtros de usuario
        const conflictingAllergens = recipeAllergens.filter((allergenId) =>
          filteredAllergens.includes(allergenId)
        );

        if (conflictingAllergens.length > 0) {
          // Analizar severidad de conflictos
          const conflictAnalysis = this.analyzeConflictSeverity(conflictingAllergens);

          conflicts.push({
            recipeId: item.recipe.id,
            recipeName: item.recipe.name,
            sectionId: section.id,
            sectionName: section.name,
            itemId: item.id,
            itemName: item.recipeName,
            filteredAllergens: conflictingAllergens,
            severity: conflictAnalysis.maxSeverity,
            riskLevel: conflictAnalysis.riskLevel,
            affectedIngredients: await this.getAffectedIngredients(
              item.recipe.id,
              conflictingAllergens
            ),
            recommendations: this.generateRecommendations(conflictingAllergens),
          });
        }
      }
    }
  }

  // Ordenar conflictos por severidad
  conflicts.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return conflicts;
}
```

### 2. Análisis de Severidad de Conflictos

```typescript
interface ConflictAnalysis {
  maxSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
  autoResolvable: boolean;
  requiresImmediateAction: boolean;
}

analyzeConflictSeverity(conflictingAllergens: number[]): ConflictAnalysis {
  let maxSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  let criticalCount = 0;
  let highCount = 0;
  let autoResolvable = true;

  for (const allergenId of conflictingAllergens) {
    const severity = SEVERITY_LEVELS[allergenId];

    if (severity.level === 'CRITICAL') {
      maxSeverity = 'CRITICAL';
      criticalCount++;
    } else if (severity.level === 'HIGH' && maxSeverity !== 'CRITICAL') {
      maxSeverity = 'HIGH';
      highCount++;
    } else if (severity.level === 'MEDIUM' && maxSeverity === 'LOW') {
      maxSeverity = 'MEDIUM';
    }

    if (!severity.autoResolve) {
      autoResolvable = false;
    }
  }

  // Determinar nivel de riesgo general
  let riskLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
  if (criticalCount > 0) {
    riskLevel = 'EXTREME';
  } else if (highCount >= 2) {
    riskLevel = 'HIGH';
  } else if (highCount >= 1 || conflictingAllergens.length >= 3) {
    riskLevel = 'MODERATE';
  } else {
    riskLevel = 'LOW';
  }

  return {
    maxSeverity,
    riskLevel,
    autoResolvable,
    requiresImmediateAction: maxSeverity === 'CRITICAL' || maxSeverity === 'HIGH',
  };
}
```

### 3. Identificación de Ingredientes Afectados

```typescript
async getAffectedIngredients(
  recipeId: string,
  conflictingAllergens: number[]
): Promise<AffectedIngredient[]> {
  const recipe = await this.prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          product: true,
        },
      },
      subRecipes: {
        include: {
          subRecipe: {
            include: {
              ingredients: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const affectedIngredients: AffectedIngredient[] = [];

  // Verificar ingredientes directos
  for (const ingredient of recipe.ingredients) {
    if (ingredient.product.allergens) {
      const conflicts = ingredient.product.allergens.filter((allergenId) =>
        conflictingAllergens.includes(allergenId)
      );

      if (conflicts.length > 0) {
        affectedIngredients.push({
          productId: ingredient.productId,
          productName: ingredient.product.name,
          conflictingAllergens: conflicts,
          type: 'DIRECT',
        });
      }
    }
  }

  // Verificar ingredientes de sub-recetas (recursivo)
  for (const subRecipeRel of recipe.subRecipes) {
    const subRecipeIngredients = await this.getAffectedIngredients(
      subRecipeRel.subRecipeId,
      conflictingAllergens
    );

    affectedIngredients.push(
      ...subRecipeIngredients.map((ing) => ({
        ...ing,
        type: 'SUB_RECIPE' as const,
        parentRecipeId: subRecipeRel.subRecipeId,
      }))
    );
  }

  return affectedIngredients;
}
```

### 4. Generación de Recomendaciones

```typescript
generateRecommendations(conflictingAllergens: number[]): string[] {
  const recommendations: string[] = [];

  for (const allergenId of conflictingAllergens) {
    const severity = SEVERITY_LEVELS[allergenId];
    const allergenInfo = ALLERGENS_INFO.find((a) => a.id === allergenId);

    if (severity.actionRequired === 'IMMEDIATE') {
      recommendations.push(
        `⚠️ ACCIÓN INMEDIATA: Eliminar o reemplazar ingredientes con ${allergenInfo.name}`
      );
    } else if (severity.actionRequired === 'SOON') {
      recommendations.push(
        `📋 Acción recomendada: Revisar ingredientes con ${allergenInfo.name}`
      );
    } else if (severity.autoResolve) {
      recommendations.push(
        `ℹ️ Considerar alternativas: ${allergenInfo.name} puede ser sustituido`
      );
    }
  }

  // Recomendaciones generales
  if (conflictingAllergens.length > 1) {
    recommendations.push(
      '🔄 Considerar crear una versión alternativa del menú sin estos alérgenos'
    );
  }

  recommendations.push('📧 Informar al personal de cocina sobre los conflictos detectados');
  recommendations.push('🏷️ Actualizar etiquetado del menú con advertencias de alérgenos');

  return recommendations;
}
```

## Sistema de Alertas en Tiempo Real

### 1. Alertas para Personal de Cocina

```typescript
interface KitchenAlert {
  alertId: string;
  tenantId: string;
  menuId: string;
  menuName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  conflicts: AllergenConflict[];
  actionsRequired: string[];
  timestamp: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

async generateKitchenAlert(
  tenantId: string,
  menuId: string,
  filteredAllergens: number[]
): Promise<KitchenAlert> {
  const conflicts = await this.detectAllergenConflicts(tenantId, menuId, filteredAllergens);

  if (conflicts.length === 0) {
    throw new BadRequestException('No conflicts detected');
  }

  // Determinar severidad general
  const maxSeverity = conflicts.reduce((max, conflict) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return Math.min(max, severityOrder[conflict.severity]);
  }, 3);

  const severity = Object.keys({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 })[
    maxSeverity
  ] as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  const menu = await this.prisma.menu.findUnique({
    where: { id: menuId },
    select: { name: true },
  });

  const alert: KitchenAlert = {
    alertId: generateId(),
    tenantId,
    menuId,
    menuName: menu.name,
    severity,
    message: this.generateAlertMessage(severity, conflicts.length),
    conflicts,
    actionsRequired: this.generateActionsRequired(severity, conflicts),
    timestamp: new Date(),
  };

  // Guardar alerta
  await this.prisma.kitchenAlert.create({
    data: {
      alertId: alert.alertId,
      tenantId,
      menuId,
      severity: alert.severity,
      message: alert.message,
      data: alert as any,
      timestamp: alert.timestamp,
    },
  });

  // Enviar notificación si es crítica
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    await this.sendCriticalNotification(tenantId, alert);
  }

  return alert;
}
```

### 2. Notificaciones Críticas

```typescript
async sendCriticalNotification(
  tenantId: string,
  alert: KitchenAlert
): Promise<void> {
  // Obtener usuarios del tenant con permisos
  const users = await this.prisma.user.findMany({
    where: {
      tenants: {
        some: {
          tenantId,
        },
      },
    },
  });

  for (const user of users) {
    // Enviar email
    await this.emailService.send({
      to: user.email,
      subject: `🚨 ALERTA CRÍTICA: Conflicto de Alérgenos en ${alert.menuName}`,
      template: 'allergen-conflict-alert',
      data: alert,
    });

    // Enviar notificación in-app
    await this.notificationService.create({
      userId: user.id,
      tenantId,
      type: 'ALLERGEN_CONFLICT',
      title: 'Conflicto de Alérgenos Detectado',
      message: alert.message,
      severity: alert.severity,
      data: { alertId: alert.alertId },
    });
  }
}

generateAlertMessage(severity: string, conflictCount: number): string {
  const severityEmoji = {
    CRITICAL: '🚨',
    HIGH: '⚠️',
    MEDIUM: '📋',
    LOW: 'ℹ️',
  };

  const messages = {
    CRITICAL: `ALERTA CRÍTICA: Se detectaron ${conflictCount} conflictos de alérgenos que podrían causar reacciones severas. ACCIÓN INMEDIATA REQUERIDA.`,
    HIGH: `ALERTA IMPORTANTE: Se detectaron ${conflictCount} conflictos de alérgenos que requieren atención inmediata.`,
    MEDIUM: `Atención: Se detectaron ${conflictCount} conflictos de alérgenos que deberían revisarse pronto.`,
    LOW: `Información: Se detectaron ${conflictCount} conflictos de alérgenos de menor severidad.`,
  };

  return `${severityEmoji[severity]} ${messages[severity]}`;
}
```

## Implementación Frontend

### 1. Componente de Detección de Conflictos

```typescript
function AllergenConflictDetector({ menuId, filteredAllergens }: Props) {
  const [conflicts, setConflicts] = useState<AllergenConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleDetectConflicts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/allergens/menus/${menuId}/conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filteredAllergens }),
      });

      const data = await response.json();
      setConflicts(data.data.conflicts || []);
    } catch (error) {
      console.error('Error detecting conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 border-red-500 text-red-900',
      HIGH: 'bg-orange-100 border-orange-500 text-orange-900',
      MEDIUM: 'bg-yellow-100 border-yellow-500 text-yellow-900',
      LOW: 'bg-blue-100 border-blue-500 text-blue-900',
    };
    return colors[severity] || 'bg-gray-100';
  };

  return (
    <div className="conflict-detector">
      <button
        onClick={handleDetectConflicts}
        disabled={loading || filteredAllergens.length === 0}
        className="detect-button"
      >
        {loading ? 'Analizando...' : 'Detectar Conflictos'}
      </button>

      {conflicts.length > 0 && (
        <div className="conflicts-container">
          <h3>⚠️ Conflictos Detectados ({conflicts.length})</h3>
          <div className="conflicts-list">
            {conflicts.map((conflict, index) => (
              <div
                key={index}
                className={`conflict-item ${getSeverityColor(conflict.severity)}`}
              >
                <div className="conflict-header">
                  <h4>{conflict.recipeName}</h4>
                  <span className="severity-badge">{conflict.severity}</span>
                </div>

                <div className="conflict-details">
                  <p><strong>Sección:</strong> {conflict.sectionName}</p>
                  <p><strong>Ítem:</strong> {conflict.itemName}</p>

                  <div className="conflicting-allergens">
                    <strong>Alérgenos conflictivos:</strong>
                    <div className="allergen-tags">
                      {conflict.filteredAllergens.map((allergenId) => (
                        <span key={allergenId} className="allergen-tag">
                          {getAllergenIcon(allergenId)}{' '}
                          {getAllergenName(allergenId)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {conflict.affectedIngredients.length > 0 && (
                    <div className="affected-ingredients">
                      <strong>Ingredientes afectados:</strong>
                      <ul>
                        {conflict.affectedIngredients.map((ing, idx) => (
                          <li key={idx}>
                            {ing.productName} ({ing.type === 'DIRECT' ? 'Directo' : 'Sub-receta'})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="recommendations">
                    <strong>Recomendaciones:</strong>
                    <ul>
                      {conflict.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length === 0 && !loading && filteredAllergens.length > 0 && (
        <div className="no-conflicts">
          ✅ No se detectaron conflictos con los filtros seleccionados
        </div>
      )}
    </div>
  );
}
```

### 2. Visualización de Cascada de Conflictos

```typescript
function ConflictCascadeViewer({ conflicts }: { conflicts: AllergenConflict[] }) {
  return (
    <div className="cascade-viewer">
      <h3>Cascada de Conflictos de Alérgenos</h3>
      <div className="cascade-tree">
        {conflicts.map((conflict, index) => (
          <div key={index} className="cascade-node">
            <div className="node-header">
              <span>🍽️</span>
              <span>{conflict.recipeName}</span>
              <span className="severity-indicator">{conflict.severity}</span>
            </div>

            <div className="node-children">
              {conflict.affectedIngredients.map((ing, idx) => (
                <div key={idx} className="child-node">
                  {ing.type === 'DIRECT' ? (
                    <span>📦 {ing.productName}</span>
                  ) : (
                    <span>👨‍🍳 {ing.productName} (sub-receta)</span>
                  )}
                  <div className="conflicting-allergens">
                    {ing.conflictingAllergens.map((allergenId) => (
                      <span key={allergenId} className="mini-tag">
                        {getAllergenIcon(allergenId)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Filtros Interactivos de Alérgenos

```typescript
function AllergenFilterSelector({
  selectedAllergens,
  onChange,
  conflicts,
}: FilterSelectorProps) {
  const getFilterStatus = (allergenId: number) => {
    const isSelected = selectedAllergens.includes(allergenId);
    const hasConflict = conflicts.some((c) =>
      c.filteredAllergens.includes(allergenId)
    );

    if (hasConflict) return 'conflict';
    if (isSelected) return 'selected';
    return 'available';
  };

  return (
    <div className="allergen-filters">
      {ALLERGENS_INFO.map((allergen) => {
        const status = getFilterStatus(allergen.id);
        return (
          <button
            key={allergen.id}
            onClick={() => {
              if (status === 'selected') {
                onChange(selectedAllergens.filter((id) => id !== allergen.id));
              } else {
                onChange([...selectedAllergens, allergen.id]);
              }
            }}
            className={`filter-btn ${status}`}
          >
            <span className="icon">{allergen.icon}</span>
            <span className="name">{allergen.name}</span>
            {status === 'conflict' && <span className="conflict-indicator">⚠️</span>}
          </button>
        );
      })}
    </div>
  );
}
```

## Sistema de Mitigación de Conflictos

### 1. Sugerencias de Sustituciones

```typescript
interface SubstitutionSuggestion {
  originalIngredient: string;
  suggestedSubstitution: string;
  allergenRemoved: number;
  confidence: number;
  availabilityCheck: boolean;
}

async suggestSubstitutions(
  recipeId: string,
  conflictingAllergens: number[]
): Promise<SubstitutionSuggestion[]> {
  const suggestions: SubstitutionSuggestion[] = [];

  const recipe = await this.prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          product: true,
        },
      },
    },
  });

  for (const ingredient of recipe.ingredients) {
    if (ingredient.product.allergens) {
      const conflicts = ingredient.product.allergens.filter((allergenId) =>
        conflictingAllergens.includes(allergenId)
      );

      for (const conflictAllergen of conflicts) {
        // Buscar productos alternativos sin este alérgeno
        const alternatives = await this.prisma.product.findMany({
          where: {
            id: { not: ingredient.productId },
            category: ingredient.product.category,
            allergens: {
              none: conflictAllergen,
            },
          },
          take: 3,
        });

        for (const alternative of alternatives) {
          suggestions.push({
            originalIngredient: ingredient.product.name,
            suggestedSubstitution: alternative.name,
            allergenRemoved: conflictAllergen,
            confidence: this.calculateSubstitutionConfidence(
              ingredient.product,
              alternative
            ),
            availabilityCheck: await this.checkProductAvailability(alternative.id),
          });
        }
      }
    }
  }

  // Ordenar por confianza
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions.slice(0, 10);
}
```

### 2. Generación de Menús Alternativos

```typescript
async generateAlternativeMenu(
  tenantId: string,
  originalMenuId: string,
  excludedAllergens: number[]
): Promise<Menu> {
  const originalMenu = await this.prisma.menu.findUnique({
    where: { id: originalMenuId },
    include: {
      sections: {
        include: {
          items: {
            include: {
              recipe: true,
            },
          },
        },
      },
    },
  });

  // Crear menú alternativo
  const alternativeMenu = await this.prisma.menu.create({
    data: {
      tenantId,
      name: `${originalMenu.name} (Sin Alérgenos)`,
      description: `Versión alternativa sin: ${excludedAllergens.map((id) => getAllergenName(id)).join(', ')}`,
      sections: {
        create: originalMenu.sections.map((section) => ({
          order: section.order,
          translations: section.translations,
          items: {
            create: section.items
              .filter((item) => {
                // Verificar si la receta tiene alérgenos excluidos
                const recipeAllergens = item.recipe.allergens || [];
                return !excludedAllergens.some((excluded) =>
                  recipeAllergens.includes(excluded)
                );
              })
              .map((item) => ({
                recipeId: item.recipeId,
                recipeName: item.recipeName,
                recipeDescription: item.recipeDescription,
                price: item.price,
                order: item.order,
                available: item.available,
              })),
          },
        })),
      },
    },
  });

  return alternativeMenu;
}
```

## Testing del Sistema

### Tests de Detección de Conflictos

```typescript
describe('Allergen Conflict Detection', () => {
  it('should detect peanut conflict in menu', async () => {
    const menu = await createMenuWithPeanutAllergen();
    const filteredAllergens = [5]; // Cacahuetes

    const conflicts = await allergensService.detectAllergenConflicts(
      tenantId,
      menu.id,
      filteredAllergens
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filteredAllergens).toContain(5);
  });

  it('should analyze conflict severity correctly', async () => {
    const conflicts = await allergensService.detectAllergenConflicts(
      tenantId,
      menuId,
      [5] // Cacahuetes - CRITICAL
    );

    expect(conflicts[0].severity).toBe('CRITICAL');
    expect(conflicts[0].riskLevel).toBe('EXTREME');
  });

  it('should generate appropriate recommendations', async () => {
    const conflicts = await allergensService.detectAllergenConflicts(
      tenantId,
      menuId,
      [5, 7] // Cacahuetes + Leche
    );

    expect(conflicts[0].recommendations).toContain(
      expect.stringContaining('ACCIÓN INMEDIATA')
    );
  });
});
```

## Métricas del Sistema

### KPIs de Conflictos

- **Conflictos detectados**: Total de conflictos encontrados
- **Conflictos resueltos**: Conflictos corregidos
- **Tiempo medio de resolución**: < 4 horas objetivo
- **Falsos positivos**: < 5% tolerancia
- **Menús seguros**: Porcentaje de menús sin conflictos

### Métricas de Performance

- Tiempo de detección: < 100ms por menú
- Tiempo de análisis completo: < 500ms
- Precisión de detección: > 95%
- Recuperación de detección: > 95%

## Documentación Relacionada

- [Allergen Propagation System](./allergen-propagation-system.md) - Sistema de propagación
- [UE 1169/2011 Compliance](./ue-1169-2011-compliance.md) - Cumplimiento legal
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Menu Composition System](./menu-composition-system.md) - Sistema de composición de menús