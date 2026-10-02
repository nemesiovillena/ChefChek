'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Printer, Save, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useRecipeOptions } from '@/hooks/use-recipes';
import { foldAccents } from '@/lib/utils';
import {
  useRecipePrepContext,
  useProductPrepContext,
  useLabelProductOptions,
  useCreateFoodLabel,
  useEtiquetadoConfig,
  effectiveLabelFormat,
  labelFormatOptions,
  printLabel,
  type CreateFoodLabelInput,
  type LabelType,
  type StorageCondition,
} from '@/hooks/use-food-labels';
import ConservationFieldset, {
  EMPTY_CONSERVATION,
  type ConservationValue,
} from '@/components/conservation-fieldset';
import AllergenPicker from '@/components/shared/allergen-picker';
import ResponsibleField, {
  type ResponsibleValue,
} from '@/components/responsible-field';

export const dynamic = 'force-dynamic';

const fieldClass =
  'mt-1 block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';
// Variante sin margen superior para controles que van juntos en una fila.
const compactFieldClass =
  'block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';
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
  // Plato sin receta en el sistema: se guarda como ELABORATED sin recipeId,
  // con el nombre y los alérgenos que escribe el cocinero.
  const [freeDish, setFreeDish] = useState(false);
  const [freeName, setFreeName] = useState('');
  const [freeNameConfirmed, setFreeNameConfirmed] = useState(false);
  const [freeAllergens, setFreeAllergens] = useState<number[]>([]);

  // Datos comunes del formulario
  const [preparedAt, setPreparedAt] = useState(nowLocalInput());
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [portions, setPortions] = useState('');
  const [notes, setNotes] = useState('');
  const [freeze, setFreeze] = useState(false);
  const [conservation, setConservation] = useState<ConservationValue>(EMPTY_CONSERVATION);
  const [conservationTouched, setConservationTouched] = useState(false);
  const [pickedResponsible, setResponsible] = useState<ResponsibleValue>({});
  // Cuenta personal (móvil): el responsable es quien ha iniciado sesión (el
  // backend lo impone). Solo la cuenta compartida de cocina elige responsable.
  const { user } = useAuth();
  const sharedAccount = !!user?.isSharedAccount;
  const responsible: ResponsibleValue = sharedAccount || !user ? pickedResponsible : { responsibleUserId: user.id };

  // ELABORATED
  const [ingredientLots, setIngredientLots] = useState<Record<string, string>>({});
  // Nº de lote escrito a mano cuando el lote no está registrado (opción
  // «manual:» del selector).
  const [manualIngredientLots, setManualIngredientLots] = useState<
    Record<string, string>
  >({});
  // HANDLED — origen del artículo: '' (lote a mano) | 'lot:<id>' (lote
  // registrado) | 'purchase:<albaranLineId>' (compra sin lote).
  const [sourceRef, setSourceRef] = useState('');
  const [manualLot, setManualLot] = useState('');
  const [manufacturerExpiry, setManufacturerExpiry] = useState('');

  const [copies, setCopies] = useState('1');
  // Qué botón lanzó el guardado, para mostrar el spinner en el correcto.
  const [pendingAction, setPendingAction] = useState<'save' | 'print' | null>(null);

  const recipeOptions = useRecipeOptions();
  // Filtro del desplegable de recetas (sin tildes ni mayúsculas). La receta ya
  // elegida se mantiene aunque no case, para que el select no se quede vacío.
  const [recipeQuery, setRecipeQuery] = useState('');
  const recipeNeedle = foldAccents(recipeQuery.trim());
  const filteredRecipes = (recipeOptions.data ?? []).filter(
    (r) => !recipeNeedle || r.id === recipeId || foldAccents(r.name).includes(recipeNeedle),
  );
  const [productQuery, setProductQuery] = useState('');
  // Valor diferido: no lanza una petición por cada tecla mientras se escribe.
  const productNeedle = useDeferredValue(productQuery).trim();
  const productOptions = useLabelProductOptions(productNeedle);
  const etiquetadoConfig = useEtiquetadoConfig();
  // El formato se elige una vez en Configuración → Etiquetas; aquí solo se
  // imprime el número de copias.
  const printFormat = effectiveLabelFormat(etiquetadoConfig.data);
  const printFormatLabel =
    labelFormatOptions(etiquetadoConfig.data).find((o) => o.value === printFormat)
      ?.label ?? '';

  const recipeCtx = useRecipePrepContext(labelType === 'ELABORATED' ? recipeId : null);
  const productCtx = useProductPrepContext(labelType === 'HANDLED' ? productId : null);

  const ctxConservation = recipeCtx.data?.conservation ?? productCtx.data?.conservation;
  const effectiveConservation: ConservationValue = useMemo(() => {
    if (conservationTouched) return conservation;
    return ctxConservation ? conservationFromConfig(ctxConservation) : EMPTY_CONSERVATION;
  }, [conservationTouched, conservation, ctxConservation]);

  const selectedName = freeDish
    ? freeName.trim()
    : (recipeCtx.data?.name ?? productCtx.data?.name ?? '');

  const ready =
    (freeDish && freeNameConfirmed && freeName.trim() !== '') ||
    (labelType === 'ELABORATED' && Boolean(recipeCtx.data)) ||
    (labelType === 'HANDLED' && Boolean(productCtx.data));

  // «Guardar» solo registra la etiqueta; «Imprimir» la registra y la imprime
  // (imprimir necesita el id de la etiqueta guardada).
  const handleSave = async (print: boolean) => {
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

    if (print && !printFormat) {
      addNotification({
        type: 'error',
        title: 'Falta el formato de etiqueta',
        message: 'No hay formatos configurados: define uno en Ajustes → Etiquetas.',
      });
      return;
    }

    if (!responsible.responsibleUserId && !responsible.responsibleName?.trim()) {
      addNotification({
        type: 'error',
        title: 'Falta el responsable',
        message: 'Indica quién ha realizado la elaboración o manipulación.',
      });
      return;
    }

    // El consumo preferente: congelado → vida útil de congelado; si no, la normal.
    const shelfLifeFrozenDays = num(effectiveConservation.shelfLifeFrozenDays);
    if (freeze ? !shelfLifeFrozenDays : !shelfLifeDays) {
      addNotification({
        type: 'error',
        title: 'Falta el consumo preferente',
        message: freeze
          ? 'Indica los días de vida útil de congelado (en Conservación y vida útil).'
          : 'Indica los días de vida útil (en Conservación y vida útil) o configúralos en la receta/artículo.',
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
      responsibleUserId: responsible.responsibleUserId,
      responsibleName: responsible.responsibleName?.trim() || undefined,
    };

    if (freeDish) {
      input.itemName = freeName.trim();
      input.allergens = freeAllergens;
    } else if (labelType === 'ELABORATED') {
      input.recipeId = recipeId ?? undefined;
      input.ingredientLots = (recipeCtx.data?.ingredients ?? []).map((ing) => {
        const raw = ingredientLots[ing.productId] ?? '';
        const isLinked = raw.startsWith('lot:');
        return {
          productId: ing.productId,
          productName: ing.productName,
          lotId: isLinked ? raw.slice(4) : undefined,
          lotNumber: isLinked
            ? (ing.availableLots.find((l) => l.id === raw.slice(4))
                ?.lotNumber ?? '')
            : raw === 'manual:'
              ? (manualIngredientLots[ing.productId] ?? '').trim()
              : raw,
          quantityUsed: ing.quantity,
          unit: ing.unit,
        };
      });
    } else {
      input.productId = productId ?? undefined;
      input.sourceLotId = sourceRef.startsWith('lot:')
        ? sourceRef.slice(4)
        : undefined;
      input.sourcePurchaseLineId = sourceRef.startsWith('purchase:')
        ? sourceRef.slice(9)
        : undefined;
      input.lotNumber = sourceRef ? undefined : manualLot.trim() || undefined;
      input.manufacturerExpiryDate = manufacturerExpiry
        ? new Date(manufacturerExpiry).toISOString()
        : undefined;
    }

    setPendingAction(print ? 'print' : 'save');
    try {
      const created = await createLabel.mutateAsync(input);
      addNotification({
        type: 'success',
        title: 'Etiqueta creada',
        message: `Lote ${created.lotNumber}`,
      });
      if (print && printFormat) {
        await printLabel(created.id, printFormat, Number(copies) || 1, {
          onError: (m) =>
            addNotification({ type: 'error', title: 'Impresión', message: m }),
          onSuccess: printFormat.startsWith('thermal:')
            ? () =>
                addNotification({
                  type: 'success',
                  title: 'Enviada a la impresora',
                  message: '',
                })
            : undefined,
        });
      }
      router.push(`/dashboard/etiquetado/${created.id}`);
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'No se pudo crear la etiqueta',
      });
    } finally {
      setPendingAction(null);
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
            <div className="mt-2 flex flex-wrap gap-3">
              <Button
                variant={labelType === 'ELABORATED' && !freeDish ? 'default' : 'outline'}
                onClick={() => {
                  setLabelType('ELABORATED');
                  setFreeDish(false);
                  setProductId(null);
                }}
              >
                Plato elaborado (receta)
              </Button>
              <Button
                variant={labelType === 'HANDLED' ? 'default' : 'outline'}
                onClick={() => {
                  setLabelType('HANDLED');
                  setFreeDish(false);
                  setRecipeId(null);
                }}
              >
                Artículo manipulado
              </Button>
              <Button
                variant={freeDish ? 'default' : 'outline'}
                onClick={() => {
                  setLabelType('ELABORATED');
                  setFreeDish(true);
                  setRecipeId(null);
                  setProductId(null);
                }}
              >
                Plato sin receta
              </Button>
            </div>
          </div>

          {freeDish && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (freeName.trim()) setFreeNameConfirmed(true);
              }}
            >
              <label className="block">
                <span className={labelClass}>Nombre del plato</span>
                <input
                  className={fieldClass}
                  placeholder="Ej. Arroz de calamar y almejas"
                  maxLength={120}
                  autoFocus
                  value={freeName}
                  onChange={(e) => setFreeName(e.target.value)}
                />
                <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                  Para platos que no están en Recetas. Es lo que se imprime en
                  la etiqueta.
                </span>
              </label>
              <Button type="submit" className="mt-3" disabled={!freeName.trim()}>
                Continuar
              </Button>
            </form>
          )}

          {labelType === 'ELABORATED' && !freeDish && (
            <div>
              <span className={labelClass}>Receta</span>
              <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  type="search"
                  className={compactFieldClass}
                  placeholder="Buscar receta…"
                  aria-label="Buscar receta"
                  value={recipeQuery}
                  onChange={(e) => setRecipeQuery(e.target.value)}
                />
                <select
                  className={compactFieldClass}
                  style={{ colorScheme: 'light dark' }}
                  aria-label="Receta"
                  value={recipeId ?? ''}
                  onChange={(e) => setRecipeId(e.target.value || null)}
                >
                  <option value="">
                    {recipeQuery.trim()
                      ? `${filteredRecipes.length} receta${filteredRecipes.length === 1 ? '' : 's'} encontrada${filteredRecipes.length === 1 ? '' : 's'}…`
                      : 'Elige una receta…'}
                  </option>
                  {filteredRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-2"
                  disabled={!recipeQuery && !recipeId}
                  onClick={() => {
                    setRecipeQuery('');
                    setRecipeId(null);
                  }}
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </div>
          )}

          {labelType === 'HANDLED' && (
            <div>
              <span className={labelClass}>Artículo</span>
              <input
                className={fieldClass}
                placeholder="Buscar artículo…"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
              {productNeedle && productOptions.isLoading && (
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Buscando…</p>
              )}
              {productNeedle && productOptions.isError && (
                <p className="mt-1 text-sm text-[var(--error)]">
                  No se han podido buscar artículos: {productOptions.error.message}
                </p>
              )}
              {productNeedle && productOptions.data?.length === 0 && (
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  Ningún artículo coincide con «{productNeedle}».
                </p>
              )}
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--outline-variant)]">
                {(productNeedle ? (productOptions.data ?? []) : []).map((p) => (
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
            <div className="mb-3 flex items-center gap-3">
              <span className="text-lg font-semibold text-[var(--on-surface)]">
                {selectedName}
              </span>
              {freeDish && (
                <button
                  type="button"
                  className="text-sm text-[var(--on-surface-variant)] underline"
                  onClick={() => setFreeNameConfirmed(false)}
                >
                  Cambiar nombre
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
              <label>
                <span className={labelClass}>
                  {labelType === 'ELABORATED' ? 'Elaboración' : 'Manipulación'}
                </span>
                <input
                  type="datetime-local"
                  className={`${fieldClass} h-10`}
                  style={{ colorScheme: 'light dark' }}
                  value={preparedAt}
                  onChange={(e) => {
                    setPreparedAt(e.target.value);
                    // En escritorio el picker queda abierto tras elegir el día
                    // (espera la hora): se cierra al perder el foco. En táctil
                    // no se fuerza, para no cerrar los wheels a mitad de edición.
                    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                      e.target.blur();
                    }
                  }}
                />
                <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                  {labelType === 'ELABORATED'
                    ? 'Cuándo se preparó el plato; el consumo preferente se calcula desde esta fecha.'
                    : 'Cuándo se manipuló o envasó; el consumo preferente se calcula desde esta fecha.'}
                </span>
              </label>
              <label>
                <span className={labelClass}>Cantidad</span>
                <div className="flex gap-2">
                  <input
                    className={`${fieldClass} h-10`}
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <input
                    className={`${fieldClass} h-10 w-20`}
                    placeholder="ud/kg"
                    value={quantityUnit}
                    onChange={(e) => setQuantityUnit(e.target.value)}
                  />
                </div>
                <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                  Cuánto producto hay en el envase: peso, volumen o unidades
                  (ej. 2,5 kg). Opcional.
                </span>
              </label>
              {labelType === 'ELABORATED' && (
                <label>
                  <span className={labelClass}>Raciones</span>
                  <input
                    className={`${fieldClass} h-10`}
                    inputMode="decimal"
                    value={portions}
                    onChange={(e) => setPortions(e.target.value)}
                    placeholder={recipeCtx.data?.portions?.toString() ?? ''}
                  />
                  <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                    Nº de platos que rinde lo preparado (ej. 8). Si preparaste
                    más cantidad que la receta, ajústalo. Opcional.
                  </span>
                </label>
              )}
            </div>

            <div className="mt-3">
              <ResponsibleField
                value={responsible}
                onChange={setResponsible}
                fixedName={sharedAccount ? undefined : user?.name}
              />
              <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                Quién ha realizado la {labelType === 'ELABORATED' ? 'elaboración' : 'manipulación'};
                queda impreso en la etiqueta.
              </span>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={freeze}
                onChange={(e) => {
                  setFreeze(e.target.checked);
                  if (e.target.checked) {
                    // Congelar implica conservación «Congelado»: sincroniza el
                    // selector y aplica sus valores por defecto.
                    setConservationTouched(true);
                    setConservation({
                      ...effectiveConservation,
                      storageCondition: 'FROZEN',
                      ...CONDITION_DEFAULTS.FROZEN,
                    });
                  }
                }}
              />
              Se congela
            </label>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              Marca la conservación como «Congelado» y calcula el consumo
              preferente con la vida útil de congelado.
            </p>
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
              if (patch.storageCondition !== undefined) {
                // La condición manda sobre el checkbox: solo «Congelado» congela
                // (sella frozenAt y calcula el consumo preferente congelado).
                setFreeze(patch.storageCondition === 'FROZEN');
              }
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
              <div className="mb-1 text-sm font-semibold">Lotes de ingredientes</div>
              <p className="mb-2 text-xs text-[var(--on-surface-variant)]">
                Elige el lote usado en cada ingrediente. Si todavía no está
                registrado en el sistema, selecciona «Otro nº de lote…» y
                escríbelo tal cual figure en el envase: quedará grabado en la
                etiqueta.
              </p>
              <div className="space-y-2">
                {recipeCtx.data!.ingredients.map((ing) => (
                  <div key={ing.productId} className="grid grid-cols-2 items-center gap-3">
                    <span className="text-sm">{ing.productName}</span>
                    {ing.availableLots.length > 0 ? (
                      <div>
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
                          <option value="manual:">Otro nº de lote…</option>
                        </select>
                        {(ingredientLots[ing.productId] ?? '') === 'manual:' && (
                          <input
                            className={`${fieldClass} mt-2`}
                            placeholder="Nº de lote del envase"
                            value={manualIngredientLots[ing.productId] ?? ''}
                            onChange={(e) =>
                              setManualIngredientLots((m) => ({
                                ...m,
                                [ing.productId]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </div>
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

          {/* HANDLED: origen del artículo (lote o compra) */}
          {labelType === 'HANDLED' && (
            <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
              <label className="block">
                <span className={labelClass}>Lote o compra del proveedor</span>
                <select
                  className={fieldClass}
                  style={{ colorScheme: 'light dark' }}
                  value={sourceRef}
                  onChange={(e) => {
                    setSourceRef(e.target.value);
                    const lotId = e.target.value.startsWith('lot:')
                      ? e.target.value.slice(4)
                      : '';
                    const lot = productCtx.data?.lots.find(
                      (l) => l.id === lotId,
                    );
                    if (lot?.expiryDate) {
                      setManufacturerExpiry(lot.expiryDate.slice(0, 10));
                    }
                  }}
                >
                  <option value="">— (escribir el lote a mano)</option>
                  {(productCtx.data?.lots ?? []).length > 0 && (
                    <optgroup label="Lotes registrados">
                      {productCtx.data!.lots.map((l) => (
                        <option key={l.id} value={`lot:${l.id}`}>
                          {l.lotNumber}
                          {l.supplierName ? ` · ${l.supplierName}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(productCtx.data?.purchases ?? []).length > 0 && (
                    <optgroup label="Compras sin lote">
                      {productCtx.data!.purchases.map((p) => (
                        <option
                          key={p.albaranLineId}
                          value={`purchase:${p.albaranLineId}`}
                        >
                          compra{' '}
                          {new Intl.DateTimeFormat('es-ES', {
                            timeZone: 'Europe/Madrid',
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          }).format(new Date(p.date))}
                          {p.supplierName ? ` · ${p.supplierName}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                  Si el artículo no trae lote (habitual en Makro), elige la
                  compra: la etiqueta pondrá «LOTE compra {'{'}fecha{'}'}» y el
                  proveedor.
                </span>
              </label>
              {!sourceRef && (
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

          {freeDish && (
            <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
              <span className={labelClass}>Alérgenos</span>
              <p className="mb-3 mt-1 text-xs text-[var(--on-surface-variant)]">
                Marca los que lleva el plato; se imprimen en la etiqueta. Sin
                receta no se pueden calcular solos.
              </p>
              <AllergenPicker value={freeAllergens} onChange={setFreeAllergens} />
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
              <span className={labelClass}>Copias</span>
              <input
                className={`${fieldClass} w-24`}
                inputMode="numeric"
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              />
            </label>
            <Button onClick={() => handleSave(false)} disabled={pendingAction !== null}>
              {pendingAction === 'save' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={pendingAction !== null}
            >
              {pendingAction === 'print' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Imprimir
            </Button>
            <p className="w-full text-xs text-[var(--on-surface-variant)]">
              Formato: {printFormatLabel || '—'}. Se elige en Configuración →
              Etiquetas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
