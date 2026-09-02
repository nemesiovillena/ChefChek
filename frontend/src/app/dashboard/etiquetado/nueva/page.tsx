'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useRecipeOptions } from '@/hooks/use-recipes';
import { useProductSearch } from '@/hooks/use-product-search';
import {
  useRecipePrepContext,
  useProductPrepContext,
  useCreateFoodLabel,
  useEtiquetadoConfig,
  labelFormatOptions,
  openLabelPdf,
  type CreateFoodLabelInput,
  type LabelType,
  type StorageCondition,
} from '@/hooks/use-food-labels';
import ConservationFieldset, {
  EMPTY_CONSERVATION,
  type ConservationValue,
} from '@/components/conservation-fieldset';

export const dynamic = 'force-dynamic';

const fieldClass =
  'mt-1 block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';
const labelClass = 'block text-sm font-medium text-[var(--on-surface)]';

const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const num = (s: string): number | undefined => {
  if (s.trim() === '') return undefined;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Valores por defecto de temperatura / vida útil al elegir una condición de
 * conservación en el formulario de etiqueta. Solo se aplican cuando el usuario
 * cambia la condición a mano, para ahorrar tecleo; siguen siendo editables.
 */
const CONDITION_DEFAULTS: Record<string, Partial<ConservationValue>> = {
  FROZEN: { storageTempMin: '-15', shelfLifeFrozenDays: '90' },
  REFRIGERATED: { storageTempMin: '2', shelfLifeDays: '5' },
};

function conservationFromConfig(c: {
  storageCondition: string | null;
  storageTempMin: number | null;
  storageTempMax: number | null;
  shelfLifeDays: number | null;
  shelfLifeFrozenDays: number | null;
}): ConservationValue {
  return {
    storageCondition: c.storageCondition ?? '',
    storageTempMin: c.storageTempMin?.toString() ?? '',
    storageTempMax: c.storageTempMax?.toString() ?? '',
    shelfLifeDays: c.shelfLifeDays?.toString() ?? '',
    shelfLifeFrozenDays: c.shelfLifeFrozenDays?.toString() ?? '',
  };
}

export default function NuevaEtiquetaPage() {
  const router = useRouter();
  const params = useSearchParams();
  const addNotification = useNotification();
  const createLabel = useCreateFoodLabel();

  const presetRecipeId = params.get('recipeId');
  const presetProductId = params.get('productId');

  const [labelType, setLabelType] = useState<LabelType | ''>(
    presetRecipeId ? 'ELABORATED' : presetProductId ? 'HANDLED' : '',
  );
  const [recipeId, setRecipeId] = useState<string | null>(presetRecipeId);
  const [productId, setProductId] = useState<string | null>(presetProductId);

  // Datos comunes del formulario
  const [preparedAt, setPreparedAt] = useState(nowLocalInput());
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [portions, setPortions] = useState('');
  const [notes, setNotes] = useState('');
  const [freeze, setFreeze] = useState(false);
  const [conservation, setConservation] = useState<ConservationValue>(EMPTY_CONSERVATION);
  const [conservationTouched, setConservationTouched] = useState(false);

  // ELABORATED
  const [ingredientLots, setIngredientLots] = useState<Record<string, string>>({});
  // HANDLED
  const [sourceLotId, setSourceLotId] = useState('');
  const [manualLot, setManualLot] = useState('');
  const [manufacturerExpiry, setManufacturerExpiry] = useState('');

  const [format, setFormat] = useState('');
  const [copies, setCopies] = useState('1');

  const recipeOptions = useRecipeOptions();
  const productSearch = useProductSearch(300);
  const etiquetadoConfig = useEtiquetadoConfig();
  const formatOptions = useMemo(
    () => labelFormatOptions(etiquetadoConfig.data),
    [etiquetadoConfig.data],
  );
  const selectedFormat = format || formatOptions[0]?.value || '';

  const recipeCtx = useRecipePrepContext(labelType === 'ELABORATED' ? recipeId : null);
  const productCtx = useProductPrepContext(labelType === 'HANDLED' ? productId : null);

  const ctxConservation = recipeCtx.data?.conservation ?? productCtx.data?.conservation;
  const effectiveConservation: ConservationValue = useMemo(() => {
    if (conservationTouched) return conservation;
    return ctxConservation ? conservationFromConfig(ctxConservation) : EMPTY_CONSERVATION;
  }, [conservationTouched, conservation, ctxConservation]);

  const selectedName =
    recipeCtx.data?.name ?? productCtx.data?.name ?? '';

  const ready =
    (labelType === 'ELABORATED' && Boolean(recipeCtx.data)) ||
    (labelType === 'HANDLED' && Boolean(productCtx.data));

  const handleSave = async () => {
    const shelfLifeDays = num(effectiveConservation.shelfLifeDays);
    const storageCondition = effectiveConservation.storageCondition || undefined;

    if (!storageCondition) {
      addNotification({
        type: 'error',
        title: 'Falta la conservación',
        message: 'Indica la condición de conservación.',
      });
      return;
    }

    const input: CreateFoodLabelInput = {
      labelType: labelType as LabelType,
      preparedAt: new Date(preparedAt).toISOString(),
      storageCondition: storageCondition as StorageCondition,
      storageTempMin: num(effectiveConservation.storageTempMin),
      storageTempMax: num(effectiveConservation.storageTempMax),
      shelfLifeDays,
      shelfLifeFrozenDays: num(effectiveConservation.shelfLifeFrozenDays),
      quantity: num(quantity),
      quantityUnit: quantityUnit.trim() || undefined,
      portions: num(portions),
      notes: notes.trim() || undefined,
      freeze,
    };

    if (labelType === 'ELABORATED') {
      input.recipeId = recipeId ?? undefined;
      input.ingredientLots = (recipeCtx.data?.ingredients ?? []).map((ing) => ({
        productId: ing.productId,
        productName: ing.productName,
        lotId: ingredientLots[ing.productId]?.startsWith('lot:')
          ? ingredientLots[ing.productId].slice(4)
          : undefined,
        lotNumber:
          ingredientLots[ing.productId]?.startsWith('lot:')
            ? (ing.availableLots.find(
                (l) => l.id === ingredientLots[ing.productId].slice(4),
              )?.lotNumber ?? '')
            : (ingredientLots[ing.productId] ?? ''),
        quantityUsed: ing.quantity,
        unit: ing.unit,
      }));
    } else {
      input.productId = productId ?? undefined;
      input.sourceLotId = sourceLotId || undefined;
      input.lotNumber = sourceLotId ? undefined : manualLot.trim() || undefined;
      input.manufacturerExpiryDate = manufacturerExpiry
        ? new Date(manufacturerExpiry).toISOString()
        : undefined;
    }

    try {
      const created = await createLabel.mutateAsync(input);
      addNotification({
        type: 'success',
        title: 'Etiqueta creada',
        message: `Lote ${created.lotNumber}`,
      });
      await openLabelPdf(created.id, selectedFormat, Number(copies) || 1, {
        onError: (m) =>
          addNotification({ type: 'error', title: 'PDF', message: m }),
      });
      router.push(`/dashboard/etiquetado/${created.id}`);
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'No se pudo crear la etiqueta',
      });
    }
  };

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/etiquetado')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">
        Nueva etiqueta
      </h2>

      {/* Paso 1: tipo + entidad */}
      {!ready && (
        <div className="space-y-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <div>
            <span className={labelClass}>¿Qué vas a etiquetar?</span>
            <div className="mt-2 flex gap-3">
              <Button
                variant={labelType === 'ELABORATED' ? 'default' : 'outline'}
                onClick={() => {
                  setLabelType('ELABORATED');
                  setProductId(null);
                }}
              >
                Plato elaborado (receta)
              </Button>
              <Button
                variant={labelType === 'HANDLED' ? 'default' : 'outline'}
                onClick={() => {
                  setLabelType('HANDLED');
                  setRecipeId(null);
                }}
              >
                Artículo manipulado
              </Button>
            </div>
          </div>

          {labelType === 'ELABORATED' && (
            <label className="block">
              <span className={labelClass}>Receta</span>
              <select
                className={fieldClass}
                style={{ colorScheme: 'light dark' }}
                value={recipeId ?? ''}
                onChange={(e) => setRecipeId(e.target.value || null)}
              >
                <option value="">Elige una receta…</option>
                {(recipeOptions.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {labelType === 'HANDLED' && (
            <div>
              <span className={labelClass}>Artículo</span>
              <input
                className={fieldClass}
                placeholder="Buscar artículo…"
                value={productSearch.search}
                onChange={(e) => productSearch.setSearch(e.target.value)}
              />
              {productSearch.loading && (
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Buscando…</p>
              )}
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--outline-variant)]">
                {productSearch.products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setProductId(p.id)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-container)]"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(recipeCtx.isLoading || productCtx.isLoading) && (
            <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos…
            </div>
          )}
        </div>
      )}

      {/* Paso 2: formulario */}
      {ready && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
            <div className="mb-3 text-lg font-semibold text-[var(--on-surface)]">
              {selectedName}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label>
                <span className={labelClass}>
                  {labelType === 'ELABORATED' ? 'Elaboración' : 'Manipulación'}
                </span>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  style={{ colorScheme: 'light dark' }}
                  value={preparedAt}
                  onChange={(e) => setPreparedAt(e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Cantidad</span>
                <div className="mt-1 flex gap-2">
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <input
                    className={`${fieldClass} w-20`}
                    placeholder="ud/kg"
                    value={quantityUnit}
                    onChange={(e) => setQuantityUnit(e.target.value)}
                  />
                </div>
              </label>
              {labelType === 'ELABORATED' && (
                <label>
                  <span className={labelClass}>Raciones</span>
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    value={portions}
                    onChange={(e) => setPortions(e.target.value)}
                    placeholder={recipeCtx.data?.portions?.toString() ?? ''}
                  />
                </label>
              )}
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={freeze}
                onChange={(e) => setFreeze(e.target.checked)}
              />
              Se congela
            </label>
          </div>

          <ConservationFieldset
            value={effectiveConservation}
            onChange={(patch) => {
              setConservationTouched(true);
              const next = { ...effectiveConservation, ...patch };
              if (
                patch.storageCondition !== undefined &&
                patch.storageCondition !== effectiveConservation.storageCondition
              ) {
                Object.assign(next, CONDITION_DEFAULTS[patch.storageCondition] ?? {});
              }
              setConservation(next);
            }}
            shelfLifeLabel={
              labelType === 'ELABORATED'
                ? 'Vida útil tras elaboración (días)'
                : 'Vida útil tras manipulación (días)'
            }
          />

          {/* ELABORATED: lotes de ingredientes */}
          {labelType === 'ELABORATED' && (recipeCtx.data?.ingredients.length ?? 0) > 0 && (
            <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
              <div className="mb-2 text-sm font-semibold">Lotes de ingredientes</div>
              <div className="space-y-2">
                {recipeCtx.data!.ingredients.map((ing) => (
                  <div key={ing.productId} className="grid grid-cols-2 items-center gap-3">
                    <span className="text-sm">{ing.productName}</span>
                    {ing.availableLots.length > 0 ? (
                      <select
                        className={fieldClass}
                        style={{ colorScheme: 'light dark' }}
                        value={ingredientLots[ing.productId] ?? ''}
                        onChange={(e) =>
                          setIngredientLots((m) => ({
                            ...m,
                            [ing.productId]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Sin especificar</option>
                        {ing.availableLots.map((l) => (
                          <option key={l.id} value={`lot:${l.id}`}>
                            {l.lotNumber}
                            {l.supplierName ? ` · ${l.supplierName}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={fieldClass}
                        placeholder={ing.lastKnownLot ?? 'Lote (texto libre)'}
                        value={ingredientLots[ing.productId] ?? ''}
                        onChange={(e) =>
                          setIngredientLots((m) => ({
                            ...m,
                            [ing.productId]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
              {(recipeCtx.data?.subRecipes.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
                  Sub-recetas (sin desglose de lote en esta versión):{' '}
                  {recipeCtx.data!.subRecipes.map((s) => s.name).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* HANDLED: lote de proveedor */}
          {labelType === 'HANDLED' && (
            <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
              <label className="block">
                <span className={labelClass}>Lote del proveedor</span>
                <select
                  className={fieldClass}
                  style={{ colorScheme: 'light dark' }}
                  value={sourceLotId}
                  onChange={(e) => {
                    setSourceLotId(e.target.value);
                    const lot = productCtx.data?.lots.find((l) => l.id === e.target.value);
                    if (lot?.expiryDate) {
                      setManufacturerExpiry(lot.expiryDate.slice(0, 10));
                    }
                  }}
                >
                  <option value="">— (escribir a mano)</option>
                  {(productCtx.data?.lots ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber}
                      {l.supplierName ? ` · ${l.supplierName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {!sourceLotId && (
                <label className="mt-3 block">
                  <span className={labelClass}>Nº de lote (texto libre)</span>
                  <input
                    className={fieldClass}
                    value={manualLot}
                    onChange={(e) => setManualLot(e.target.value)}
                  />
                </label>
              )}
              <label className="mt-3 block">
                <span className={labelClass}>Caducidad del fabricante</span>
                <input
                  type="date"
                  className={fieldClass}
                  style={{ colorScheme: 'light dark' }}
                  value={manufacturerExpiry}
                  onChange={(e) => setManufacturerExpiry(e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
            <label className="block">
              <span className={labelClass}>Notas</span>
              <textarea
                className={fieldClass}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          {/* Impresión */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
            <label>
              <span className={labelClass}>Formato</span>
              <select
                className={fieldClass}
                style={{ colorScheme: 'light dark' }}
                value={selectedFormat}
                onChange={(e) => setFormat(e.target.value)}
              >
                {formatOptions.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Copias</span>
              <input
                className={`${fieldClass} w-24`}
                inputMode="numeric"
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              />
            </label>
            <Button onClick={handleSave} disabled={createLabel.isPending}>
              {createLabel.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar e imprimir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
