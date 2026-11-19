'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlbaranLine } from '@/lib/api-albaran';
import {
  RETURN_REASONS,
  SETTLEMENT_LABELS,
  applyAlbaranReturn,
  createAlbaranReturn,
  formatReturnQuantity,
  type AlbaranReturn,
  type AlbaranReturnSettlement,
} from '@/lib/api-albaran-returns';

const OTHER = 'Otro';

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3);

/**
 * Línea que más se parece a lo que anotó cocina. Tolera las abreviaturas del
 * papel: «zero» casa con «ZER» (prefijo) y «coca cola» con «COCACOLA» (contenida).
 */
function suggestLine(description: string, lines: AlbaranLine[]): AlbaranLine | undefined {
  const words = normalize(description);
  const matches = (word: string, lineWords: string[]) =>
    lineWords.some((lw) => lw.includes(word) || word.startsWith(lw) || lw.startsWith(word));
  let best: AlbaranLine | undefined;
  let bestScore = 0;
  for (const line of lines) {
    const lineWords = normalize(line.description);
    const score = words.filter((w) => matches(w, lineWords)).length;
    if (score > bestScore) {
      best = line;
      bestScore = score;
    }
  }
  return best;
}

const parseQuantity = (raw: string) => {
  const n = parseFloat(raw.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface ApplyReturnDialogProps {
  albaranId: string;
  /** Líneas a las que se puede aplicar (positivas, no rechazadas, no devoluciones). */
  lines: AlbaranLine[];
  /** Devolución anotada en recepción; sin ella, se anota y aplica a la vez. */
  pendingReturn?: AlbaranReturn;
  /** Línea elegida desde la tabla («Devolver»). */
  initialLineId?: string;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Oficina aplica la devolución a una línea: crea la línea negativa debajo de
 * la original. Liquidación: descontado en este albarán (también si el
 * repartidor lo anotó a mano en el papel) o abono aparte.
 */
export function ApplyReturnDialog({
  albaranId,
  lines,
  pendingReturn,
  initialLineId,
  onClose,
  onDone,
}: ApplyReturnDialogProps) {
  const { user } = useAuth();
  const addNotification = useNotification();
  const askWho = !pendingReturn && user?.isSharedAccount === true;

  const suggested = useMemo(
    () => (pendingReturn ? suggestLine(pendingReturn.description, lines) : undefined),
    [pendingReturn, lines],
  );
  const [lineId, setLineId] = useState(initialLineId ?? suggested?.id ?? '');
  const [quantity, setQuantity] = useState(
    pendingReturn?.quantity ? String(pendingReturn.quantity).replace('.', ',') : '1',
  );
  const [settlement, setSettlement] = useState<AlbaranReturnSettlement>('IN_ALBARAN');
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [who, setWho] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const line = lines.find((l) => l.id === lineId);
  const parsedQuantity = parseQuantity(quantity);
  const finalReason = reason === OTHER ? otherReason.trim() : reason;
  const valid =
    !!line &&
    parsedQuantity !== null &&
    parsedQuantity <= line.quantity &&
    (!!pendingReturn || finalReason !== '') &&
    (!askWho || who.trim() !== '');

  const handleSubmit = async () => {
    if (!line || parsedQuantity === null) return;
    setSaving(true);
    setError(null);
    try {
      if (pendingReturn) {
        await applyAlbaranReturn(albaranId, pendingReturn.id, {
          lineId: line.id,
          quantity: parsedQuantity,
          settlement,
        });
      } else {
        await createAlbaranReturn(albaranId, {
          description: line.description,
          quantity: parsedQuantity,
          unit: line.unit,
          reason: finalReason,
          reportedByName: askWho ? who.trim() : undefined,
          lineId: line.id,
          settlement,
        });
      }
      addNotification({
        type: 'success',
        title: 'Devolución aplicada',
        message: `${formatReturnQuantity(parsedQuantity, line.unit)} de ${line.description}`,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar la devolución');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pendingReturn ? 'Aplicar devolución' : 'Devolver al proveedor'}</DialogTitle>
          <DialogDescription>
            {pendingReturn
              ? `Anotado en recepción: «${formatReturnQuantity(pendingReturn.quantity, pendingReturn.unit)}${pendingReturn.quantity !== null ? ' de ' : ''}${pendingReturn.description}» · ${pendingReturn.reason} · ${pendingReturn.reportedByName}`
              : 'Se añade una línea en negativo debajo de la original y queda la incidencia en SICTED.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Línea del albarán</span>
            <select
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-base"
            >
              <option value="">Elige la línea…</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.description} · {formatReturnQuantity(l.quantity, l.unit)}
                </option>
              ))}
            </select>
            {pendingReturn && suggested && lineId === suggested.id && (
              <span className="text-xs text-muted-foreground">Propuesta por parecido con lo anotado.</span>
            )}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Cantidad devuelta{line ? ` (${line.unit})` : ''}</span>
            <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-base" />
            {line && parsedQuantity !== null && parsedQuantity > line.quantity && (
              <span className="text-xs text-red-600">No puede ser más que lo recibido ({formatReturnQuantity(line.quantity, line.unit)}).</span>
            )}
          </label>

          {!pendingReturn && (
            <div className="space-y-1 text-sm">
              <span className="text-muted-foreground">Motivo</span>
              <div className="flex flex-wrap gap-1.5">
                {[...RETURN_REASONS, OTHER].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    aria-pressed={reason === r}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      reason === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {reason === OTHER && (
                <Input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Escribe el motivo" className="mt-1 text-base" />
              )}
            </div>
          )}

          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 text-muted-foreground">¿Cómo lo liquida el proveedor?</legend>
            {(
              [
                ['IN_ALBARAN', 'También cuando lo anota a mano en el papel. Resta cantidad e importe.'],
                ['CREDIT_NOTE', 'Resta la cantidad del stock ya; el importe llega con el abono.'],
              ] as [AlbaranReturnSettlement, string][]
            ).map(([value, help]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  settlement === value ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="return-settlement"
                  checked={settlement === value}
                  onChange={() => setSettlement(value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{value === 'CREDIT_NOTE' ? 'Llegará un abono aparte' : SETTLEMENT_LABELS[value]}</span>
                  <span className="block text-muted-foreground">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {askWho && (
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Quién lo anota</span>
              <Input value={who} onChange={(e) => setWho(e.target.value)} className="text-base" />
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!valid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
