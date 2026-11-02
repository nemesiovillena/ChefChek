'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotification } from '@/components/notification-system';
import {
  fmtPortions,
  useAdjustPortions,
  useRecountPortions,
  type PortionCounter,
} from '@/hooks/use-raciones';

export type AdjustMode = 'recount' | 'adjust';

interface Props {
  counter: PortionCounter;
  mode: AdjustMode;
  onClose: () => void;
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base';

const parseNum = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

/**
 * Recuento (se escribe la cifra real) o ajuste (+/− con motivo). Lo positivo
 * entra como raciones sin etiqueta; lo negativo se gasta de lo más antiguo.
 */
export function PortionAdjustDialog({ counter, mode, onClose }: Props) {
  const addNotification = useNotification();
  const adjust = useAdjustPortions();
  const recount = useRecountPortions();
  const [value, setValue] = useState(mode === 'recount' ? String(counter.available) : '');
  const [sign, setSign] = useState<1 | -1>(-1);
  const [reason, setReason] = useState('');
  const pending = adjust.isPending || recount.isPending;

  const amount = parseNum(value);
  const valid =
    mode === 'recount'
      ? amount !== null && amount >= 0
      : amount !== null && amount > 0 && reason.trim().length >= 2;
  const after =
    amount === null
      ? null
      : mode === 'recount'
        ? amount
        : Math.max(0, counter.available + sign * amount);

  const submit = async () => {
    if (!valid || amount === null) return;
    try {
      if (mode === 'recount') {
        await recount.mutateAsync({ id: counter.id, actual: amount, reason: reason.trim() || undefined });
      } else {
        await adjust.mutateAsync({ id: counter.id, delta: sign * amount, reason: reason.trim() });
      }
      addNotification({
        type: 'success',
        title: mode === 'recount' ? 'Recuento guardado' : 'Ajuste guardado',
        message: `${counter.name}: ${fmtPortions(after ?? 0)} raciones.`,
      });
      onClose();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: (err as Error).message,
      });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'recount' ? 'Recuento' : 'Ajustar'} · {counter.name}
          </DialogTitle>
          <DialogDescription>
            {mode === 'recount'
              ? 'Escribe las raciones que hay de verdad. El contador se corrige y queda registrado.'
              : 'Suma o resta raciones con un motivo (se cayó, se tiró, etiqueta olvidada…).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Ahora: <strong className="text-[var(--on-surface)]">{fmtPortions(counter.available)}</strong>{' '}
            raciones
          </p>

          {mode === 'adjust' && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sumar o restar">
              {([-1, 1] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={sign === s}
                  onClick={() => setSign(s)}
                  className={`min-h-[44px] rounded-lg border text-sm font-semibold ${sign === s ? 'border-primary bg-primary text-primary-foreground' : 'border-[var(--outline-variant)]'}`}
                >
                  {s === -1 ? '− Restar' : '+ Sumar'}
                </button>
              ))}
            </div>
          )}

          <label className="block text-sm">
            <span className="text-[var(--on-surface-variant)]">
              {mode === 'recount' ? 'Raciones que hay' : 'Raciones'}
            </span>
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              className={fieldClass}
            />
          </label>

          <label className="block text-sm">
            <span className="text-[var(--on-surface-variant)]">
              Motivo{mode === 'recount' ? ' (opcional)' : ''}
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder={mode === 'recount' ? 'ej. recuento de la mañana' : 'ej. se cayó al suelo'}
              className={fieldClass}
            />
          </label>

          {after !== null && valid && (
            <p className="text-sm">
              Quedarán <strong>{fmtPortions(after)}</strong> raciones.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
