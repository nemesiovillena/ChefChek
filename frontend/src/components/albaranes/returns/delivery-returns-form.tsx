'use client';

import { Plus, Undo2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { RETURN_REASONS, type NewAlbaranReturn } from '@/lib/api-albaran-returns';

export interface DeliveryReturnDraft {
  key: number;
  description: string;
  quantity: string;
  unit: string;
  reason: string;
  otherReason: string;
}

const UNITS = ['ud', 'caja', 'kilo', 'litro'] as const;
const OTHER = 'Otro';

let draftSeq = 0;
export const emptyReturnDraft = (): DeliveryReturnDraft => ({
  key: ++draftSeq,
  description: '',
  quantity: '1',
  unit: 'ud',
  reason: '',
  otherReason: '',
});

const parseQuantity = (raw: string) => {
  const n = parseFloat(raw.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const draftReason = (d: DeliveryReturnDraft) =>
  d.reason === OTHER ? d.otherReason.trim() : d.reason;

/** Fila completa: qué se devuelve y por qué. Las vacías se ignoran al subir. */
export const isDraftComplete = (d: DeliveryReturnDraft) =>
  d.description.trim() !== '' && draftReason(d) !== '';

export const isDraftTouched = (d: DeliveryReturnDraft) =>
  d.description.trim() !== '' || d.reason !== '';

export function draftToReturn(d: DeliveryReturnDraft, reportedByName?: string): NewAlbaranReturn {
  return {
    description: d.description.trim(),
    quantity: parseQuantity(d.quantity),
    unit: d.unit,
    reason: draftReason(d),
    reportedByName: reportedByName?.trim() || undefined,
  };
}

interface DeliveryReturnsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DeliveryReturnDraft[];
  onChange: (drafts: DeliveryReturnDraft[]) => void;
  /** Cuenta compartida de cocina: hay que decir quién lo anota. */
  askWho: boolean;
  who: string;
  onWhoChange: (who: string) => void;
  /** Artículos del pedido de origen, como atajo para «qué se devuelve». */
  suggestions?: string[];
}

/**
 * Bloque de la subida del albarán: lo que se ha devuelto al repartidor en la
 * entrega. Texto libre (las líneas aún no se han leído); oficina lo aplicará
 * a la línea al repasar el albarán.
 */
export function DeliveryReturnsForm({
  open,
  onOpenChange,
  drafts,
  onChange,
  askWho,
  who,
  onWhoChange,
  suggestions = [],
}: DeliveryReturnsFormProps) {
  const update = (key: number, patch: Partial<DeliveryReturnDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-amber-400 px-3 py-3 text-left text-sm font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
      >
        <span className="flex items-center gap-2">
          <Undo2 className="h-4 w-4" />
          ¿Has devuelto algo al repartidor?
        </span>
        <span className="text-xs font-normal">Anotar</span>
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <Undo2 className="h-4 w-4" />
          Devuelto al repartidor
        </span>
        <button
          type="button"
          onClick={() => {
            onChange([emptyReturnDraft()]);
            onOpenChange(false);
          }}
          className="text-xs text-amber-800 underline dark:text-amber-300"
        >
          No hubo devolución
        </button>
      </div>

      {suggestions.length > 0 && <datalist id="delivery-return-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}

      {drafts.map((d, index) => (
        <div key={d.key} className="space-y-2 rounded-md bg-background p-3">
          <div className="flex items-start gap-2">
            <label className="flex-1 space-y-1 text-xs text-muted-foreground">
              Qué se devuelve
              <Input
                value={d.description}
                onChange={(e) => update(d.key, { description: e.target.value })}
                placeholder="Ej.: cubo mayonesa 5 l"
                list={suggestions.length > 0 ? 'delivery-return-suggestions' : undefined}
                className="text-base"
                aria-label={`Qué se devuelve (${index + 1})`}
              />
            </label>
            {drafts.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                className="mt-6 rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Quitar esta devolución"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Cantidad
              <Input
                inputMode="decimal"
                value={d.quantity}
                onChange={(e) => update(d.key, { quantity: e.target.value })}
                className="text-base"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Unidad
              <select
                value={d.unit}
                onChange={(e) => update(d.key, { unit: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-base"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Motivo</span>
            <div className="flex flex-wrap gap-1.5">
              {[...RETURN_REASONS, OTHER].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update(d.key, { reason: r })}
                  aria-pressed={d.reason === r}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    d.reason === r
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {d.reason === OTHER && (
              <Input
                value={d.otherReason}
                onChange={(e) => update(d.key, { otherReason: e.target.value })}
                placeholder="Escribe el motivo"
                className="mt-1 text-base"
              />
            )}
          </div>
        </div>
      ))}

      {askWho && (
        <label className="block space-y-1 text-xs text-muted-foreground">
          Quién lo anota
          <Input value={who} onChange={(e) => onWhoChange(e.target.value)} placeholder="Tu nombre" className="text-base" />
        </label>
      )}

      <button
        type="button"
        onClick={() => onChange([...drafts, emptyReturnDraft()])}
        className="flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-300"
      >
        <Plus className="h-4 w-4" />
        Añadir otra devolución
      </button>
    </div>
  );
}
