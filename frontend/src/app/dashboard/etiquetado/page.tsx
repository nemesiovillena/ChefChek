'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Plus, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useFoodLabels,
  type FoodLabelListQuery,
  type LabelType,
} from '@/hooks/use-food-labels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      }).format(new Date(iso))
    : '—';

export default function EtiquetadoListPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();

  const [page, setPage] = useState(1);
  const [labelType, setLabelType] = useState<'' | LabelType>('');
  const [lotNumber, setLotNumber] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const query: FoodLabelListQuery = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      ...(labelType ? { labelType } : {}),
      ...(lotNumber.trim() ? { lotNumber: lotNumber.trim() } : {}),
      ...(includeVoided ? { includeVoided: true } : {}),
    }),
    [page, labelType, lotNumber, includeVoided],
  );

  const { data, isLoading } = useFoodLabels(query);
  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al dashboard
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">
            Seguridad
          </span>
          <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">
            Etiquetado
          </h2>
        </div>
        <Button onClick={() => router.push('/dashboard/etiquetado/nueva')}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva etiqueta
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Tipo</span>
          <select
            value={labelType}
            onChange={(e) => {
              setLabelType(e.target.value as '' | LabelType);
              setPage(1);
            }}
            className="mt-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
            style={{ colorScheme: 'light dark' }}
          >
            <option value="">Todos</option>
            <option value="ELABORATED">Plato elaborado</option>
            <option value="HANDLED">Artículo manipulado</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Buscar lote</span>
          <input
            value={lotNumber}
            onChange={(e) => {
              setLotNumber(e.target.value);
              setPage(1);
            }}
            placeholder="ej. JARR-310826"
            className="mt-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeVoided}
            onChange={(e) => {
              setIncludeVoided(e.target.checked);
              setPage(1);
            }}
          />
          Incluir anuladas
        </label>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <Tag className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No hay etiquetas emitidas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-container-high)] text-left text-[var(--on-surface-variant)]">
              <tr>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Elaboración</th>
                <th className="px-3 py-2">Consumo pref.</th>
                <th className="px-3 py-2">Responsable</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/dashboard/etiquetado/${r.id}`)}
                  className={`cursor-pointer border-t border-[var(--outline-variant)] hover:bg-[var(--surface-container)] ${
                    r.voidedAt ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono font-semibold">{r.lotNumber}</td>
                  <td className="px-3 py-2">{r.itemName}</td>
                  <td className="px-3 py-2">
                    {r.labelType === 'ELABORATED' ? 'Plato' : 'Artículo'}
                  </td>
                  <td className="px-3 py-2">{fmtDate(r.preparedAt)}</td>
                  <td className="px-3 py-2">{fmtDate(r.useByDate)}</td>
                  <td className="px-3 py-2">{r.createdByName}</td>
                  <td className="px-3 py-2 text-[var(--on-surface-variant)]">
                    {r.voidedAt ? 'Anulada' : r.reprintCount > 0 ? `${r.reprintCount} reimpr.` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-[var(--on-surface-variant)]">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
