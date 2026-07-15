'use client';

import { useState } from 'react';
import { FileCheck2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  useCreateInvoice,
  useDeleteInvoice,
  usePurchaseInvoices,
} from '@/hooks/use-purchase-invoices';
import type { PurchaseOrder } from '@/hooks/use-purchase-orders';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** Registro mínimo de factura (sin líneas ni vencimientos) enlazada al pedido. */
export function InvoicesSection({ order }: { order: PurchaseOrder }) {
  const { data: invoices, isLoading } = usePurchaseInvoices({
    purchaseOrderId: order.id,
  });
  const createMut = useCreateInvoice();
  const deleteMut = useDeleteInvoice();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: '',
    totalAmount: '',
    issuedAt: new Date().toISOString().slice(0, 10),
  });

  const handleCreate = async () => {
    if (!form.invoiceNumber.trim() || !form.totalAmount) return;
    try {
      await createMut.mutateAsync({
        invoiceNumber: form.invoiceNumber.trim(),
        totalAmount: Number(form.totalAmount),
        issuedAt: form.issuedAt,
        purchaseOrderId: order.id,
      });
      setForm({ invoiceNumber: '', totalAmount: '', issuedAt: new Date().toISOString().slice(0, 10) });
      setShowForm(false);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo registrar la factura',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    const ok = await confirm({
      title: `Eliminar la factura ${invoiceNumber}`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo eliminar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const inputCls =
    'rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1.5 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]';

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--on-surface)]">Facturas</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-container-low)]"
        >
          <Plus className="h-3.5 w-3.5" /> Registrar factura
        </button>
      </div>

      {showForm && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--on-surface-variant)]">Número</label>
            <input
              value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              placeholder="F-2026-001"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--on-surface-variant)]">Importe</label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              className={`${inputCls} w-28 text-right`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--on-surface-variant)]">Fecha</label>
            <input
              type="date"
              value={form.issuedAt}
              onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
              className={inputCls}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!form.invoiceNumber.trim() || !form.totalAmount || createMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas...
        </div>
      ) : (invoices ?? []).length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Sin facturas registradas.</p>
      ) : (
        <ul className="space-y-1">
          {(invoices ?? []).map((invoice) => (
            <li
              key={invoice.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 text-[var(--on-surface)]">
                <FileCheck2 className="h-4 w-4 text-[var(--on-surface-variant)]" />
                {invoice.invoiceNumber}
                <span className="text-xs text-[var(--on-surface-variant)]">
                  {new Date(invoice.issuedAt).toLocaleDateString('es-ES')}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-medium text-[var(--on-surface)]">
                  {euro.format(invoice.totalAmount)}
                </span>
                <button
                  onClick={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                  aria-label={`Eliminar factura ${invoice.invoiceNumber}`}
                  className="rounded-lg p-1.5 text-[var(--error)] hover:bg-[var(--error-container)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
