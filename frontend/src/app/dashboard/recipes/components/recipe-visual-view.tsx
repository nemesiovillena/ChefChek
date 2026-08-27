'use client';

import Image from 'next/image';
import { X, Printer, Clock, Thermometer, Wrench, ChefHat, Users } from 'lucide-react';
import { Recipe } from '@/hooks/use-recipes';
import { parseSteps } from './elaboration-step-editor';
import AllergenBadge from '@/components/shared/allergen-badge';

interface AllergenLite {
  name: string;
  icon?: string;
}

interface RecipeVisualViewProps {
  recipe: Recipe;
  allergenById: Map<number, AllergenLite>;
  isPrinting: boolean;
  onPrint: () => void;
  onClose: () => void;
}

/**
 * Vista de receta a pantalla completa: imagen, ingredientes y pasos de
 * elaboración con su equipo/tiempo/temperatura. Solo lectura — el PDF
 * (icono imprimir) sigue siendo el mismo que ya generaba "Ver receta".
 */
export default function RecipeVisualView({ recipe, allergenById, isPrinting, onPrint, onClose }: RecipeVisualViewProps) {
  const steps = parseSteps(recipe.elaboration).filter((s) => s.description.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Receta: ${recipe.name}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-[2px]"
    >
      <div className="mx-auto min-h-full w-full max-w-5xl bg-[var(--surface-container-high)] md:my-6 md:overflow-hidden md:rounded-[28px] md:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.25)]">
        {/* Hero */}
        <div className="relative h-56 w-full sm:h-72 md:h-80">
          {recipe.imageUrl ? (
            <Image src={recipe.imageUrl} alt={recipe.name} fill sizes="(min-width: 768px) 896px, 100vw" className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--tonal-2),var(--surface-container-highest))]">
              <ChefHat className="h-16 w-16 text-[var(--on-surface-variant)] opacity-40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

          <div className="absolute right-3 top-3 flex gap-2">
            <button
              type="button"
              onClick={onPrint}
              disabled={isPrinting}
              title="Imprimir receta"
              aria-label="Imprimir receta"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1f2937] shadow-sm hover:bg-white disabled:opacity-50 disabled:cursor-wait transition-colors"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1f2937] shadow-sm hover:bg-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <h2 className="text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">{recipe.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/90">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {recipe.portions} raciones{recipe.portionSize ? ` · ${recipe.portionSize}g/ud` : ''}
              </span>
              {recipe.categories?.map((cat) => (
                <span key={cat.categoryId} className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                  {cat.categoryName}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 md:p-8">
          {recipe.description && (
            <p className="mb-6 whitespace-pre-line text-sm text-[var(--on-surface-variant)]">{recipe.description}</p>
          )}

          {recipe.allergens.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--on-surface)]">Alérgenos:</span>
              {recipe.allergens.map((id) => (
                <AllergenBadge key={id} id={id} allergen={allergenById.get(id)} />
              ))}
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-[280px_1fr]">
            <aside className="md:sticky md:top-6 md:self-start">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Ingredientes
              </h3>
              {recipe.ingredients.length === 0 ? (
                <p className="text-sm text-[var(--outline)]">Sin ingredientes</p>
              ) : (
                <ul className="space-y-2">
                  {recipe.ingredients.map((ing, i) => (
                    <li
                      key={`${ing.productId}-${i}`}
                      className="flex items-baseline justify-between gap-3 border-b border-[var(--outline-variant)] pb-2 text-sm last:border-0"
                    >
                      <span className="text-[var(--on-surface)]">{ing.productName || 'Sin nombre'}</span>
                      <span className="flex-shrink-0 font-medium text-[var(--on-surface-variant)]">
                        {ing.quantity} {ing.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {recipe.subRecipes && recipe.subRecipes.length > 0 && (
                <>
                  <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                    Sub-recetas
                  </h3>
                  <ul className="space-y-2">
                    {recipe.subRecipes.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex items-baseline justify-between gap-3 border-b border-[var(--outline-variant)] pb-2 text-sm last:border-0"
                      >
                        <span className="text-[var(--on-surface)]">{sub.subRecipeName}</span>
                        <span className="flex-shrink-0 font-medium text-[var(--on-surface-variant)]">
                          {sub.quantity} {sub.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Elaboración
              </h3>
              {steps.length === 0 ? (
                <p className="text-sm text-[var(--outline)]">Sin pasos de elaboración</p>
              ) : (
                <ol className="space-y-4">
                  {steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--on-surface)]">{step.description}</p>
                        {(step.equipment || step.time || step.temperature) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {step.equipment && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary-container)] px-2 py-0.5 text-xs font-medium text-[var(--on-surface-variant)]">
                                <Wrench className="h-3 w-3" />
                                {step.equipment}
                              </span>
                            )}
                            {step.time && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary-container)] px-2 py-0.5 text-xs font-medium text-[var(--on-surface-variant)]">
                                <Clock className="h-3 w-3" />
                                {step.time}
                              </span>
                            )}
                            {step.temperature && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary-container)] px-2 py-0.5 text-xs font-medium text-[var(--on-surface-variant)]">
                                <Thermometer className="h-3 w-3" />
                                {step.temperature}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
