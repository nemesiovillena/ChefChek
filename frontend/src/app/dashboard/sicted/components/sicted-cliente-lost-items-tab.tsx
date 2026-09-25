'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, PackageSearch, Plus } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedLostItem, useReturnSictedLostItem, useSictedLostItems } from '@/hooks/use-sicted-cliente';
import type { CreateLostItemInput } from '@/lib/sicted-cliente-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

function LostItemForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const create = useCreateSictedLostItem();
  const [form, setForm] = useState<CreateLostItemInput>({ itemName: '', foundByName: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.itemName.trim() || !form.foundByName.trim()) {
      notify({ type: 'error', title: 'Faltan campos', message: 'Objeto y quién lo encuentra son obligatorios.' });
      return;
    }
    try {
      await create.mutateAsync(form);
      notify({ type: 'success', title: 'Objeto registrado', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <input value={form.itemName} onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))} placeholder="Objeto encontrado" className={inputCls} />
      <input
        value={form.description ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        placeholder="Descripción (opcional)"
        className={inputCls}
      />
      <input
        value={form.foundLocation ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, foundLocation: e.target.value }))}
        placeholder="Lugar en que se ha encontrado (opcional)"
        className={inputCls}
      />
      <input
        value={form.foundByName}
        onChange={(e) => setForm((p) => ({ ...p, foundByName: e.target.value }))}
        placeholder="Quién lo encuentra"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Registrar
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Ins-Bas.17 — objetos perdidos, agrupado con Clientes. "Devuelto" se deriva de `returnedAt`. */
export function SictedClienteLostItemsTab() {
  const notify = useNotification();
  const { data: items, isLoading } = useSictedLostItems();
  const returnItem = useReturnSictedLostItem();
  const [creating, setCreating] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnedTo, setReturnedTo] = useState('');

  async function handleReturn(id: string) {
    if (!returnedTo.trim()) {
      notify({ type: 'error', title: 'Falta a quién se devuelve', message: '' });
      return;
    }
    try {
      await returnItem.mutateAsync({ id, returnedTo });
      notify({ type: 'success', title: 'Marcado como devuelto', message: '' });
      setReturningId(null);
      setReturnedTo('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Registrar objeto
        </button>
      </div>
      {creating && <LostItemForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? null : !items || items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin objetos perdidos registrados.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{i.itemName}</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {fmtDate(i.foundAt)}
                    {i.foundLocation ? ` · ${i.foundLocation}` : ''} · encontrado por {i.foundByName}
                  </p>
                </div>
                {i.returnedAt ? (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-xs font-semibold text-[var(--on-surface)]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Devuelto
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReturningId(returningId === i.id ? null : i.id)}
                    className="min-h-[36px] rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground"
                  >
                    Marcar devuelto
                  </button>
                )}
              </div>
              {i.returnedAt && i.returnedTo && (
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Devuelto a {i.returnedTo} el {fmtDate(i.returnedAt)}</p>
              )}
              {returningId === i.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={returnedTo}
                    onChange={(e) => setReturnedTo(e.target.value)}
                    placeholder="A quién se devuelve"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={returnItem.isPending}
                    onClick={() => handleReturn(i.id)}
                    className="min-h-[48px] shrink-0 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
