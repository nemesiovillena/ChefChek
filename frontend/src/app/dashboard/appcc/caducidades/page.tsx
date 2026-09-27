'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  RETIRED_DISPOSITION_LABEL,
  useEtiquetadoConfig,
  useFoodLabels,
  type FoodLabel,
  type FoodLabelListQuery,
  type LabelType,
} from '@/hooks/use-food-labels';
import { RetireSelectionBar } from './components/retire-selection-bar';

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

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  expiring_soon: 'Próxima a caducar',
  expired: 'Caducada',
};

type RetirementFilter = 'active' | 'retired' | '';

/** Chip de estado: retirada (con fecha) o estado de caducidad. */
const statusText = (r: FoodLabel) =>
  r.retiredAt && r.retiredDisposition
    ? `${RETIRED_DISPOSITION_LABEL[r.retiredDisposition]} ${fmtDate(r.retiredAt)}`
    : STATUS_LABEL[r.expiryStatus ?? 'ok'];

/**
 * Panel de gestión de APPCC: lista TODAS las elaboraciones (ELABORATED) y
 * artículos manipulados (HANDLED) con lote, creación y caducidad — no solo
 * los que están por caducar. El toggle "Solo próximas a caducar" filtra
 * contra el umbral configurado del tenant (Settings → Etiquetado).
 *
 * Cuando el producto se gasta o se tira, se seleccionan sus etiquetas y se
 * marcan como consumidas/desechadas: dejan de alertar pero siguen en el
 * registro (filtro Estado → Retiradas / Todas).
 */
export default function CaducidadesPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { data: config } = useEtiquetadoConfig();

  const [page, setPage] = useState(1);
  const [labelType, setLabelType] = useState<'' | LabelType>('');
  const [lotNumber, setLotNumber] = useState('');
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [retirement, setRetirement] = useState<RetirementFilter>('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Cambiar filtros o página vacía la selección (las filas visibles cambian).
  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };

  const query: FoodLabelListQuery = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      sortBy: 'useByDate',
      ...(labelType ? { labelType } : {}),
      ...(lotNumber.trim() ? { lotNumber: lotNumber.trim() } : {}),
      ...(retirement ? { retirement } : {}),
      ...(onlyExpiring && config
        ? { expiringWithinDays: config.expiryWarningDays }
        : {}),
    }),
    [page, labelType, lotNumber, onlyExpiring, retirement, config],
  );

  const { data, isLoading } = useFoodLabels(query);
  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const selectableIds = rows.filter((r) => !r.retiredAt).map((r) => r.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  const goToPage = (p: number) => {
    setPage(p);
    setSelected(new Set());
  };

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div
      className={`px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pt-8 ${selected.size > 0 ? 'pb-72 md:pb-32' : 'pb-24'}`}
    >
      <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al dashboard
      </Button>

      <div className="mb-6">
        <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">
          APPCC
        </span>
        <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">
          Caducidades y trazabilidad
        </h2>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Tipo</span>
          <select
            value={labelType}
            onChange={(e) => {
              setLabelType(e.target.value as '' | LabelType);
              resetPaging();
            }}
            className="mt-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
            style={{ colorScheme: 'light dark' }}
          >
            <option value="">Todos</option>
            <option value="ELABORATED">Elaboraciones</option>
            <option value="HANDLED">Artículos manipulados</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Buscar lote</span>
          <input
            value={lotNumber}
            onChange={(e) => {
              setLotNumber(e.target.value);
              resetPaging();
            }}
            placeholder="ej. JARR-310826"
            className="mt-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyExpiring}
            onChange={(e) => {
              setOnlyExpiring(e.target.checked);
              resetPaging();
            }}
          />
          Solo próximas a caducar
        </label>
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Estado</span>
          <select
            value={retirement}
            onChange={(e) => {
              setRetirement(e.target.value as RetirementFilter);
              resetPaging();
            }}
            className="mt-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
            style={{ colorScheme: 'light dark' }}
          >
            <option value="active">Activas</option>
            <option value="retired">Retiradas (consumidas/desechadas)</option>
            <option value="">Todas</option>
          </select>
        </label>
      </div>
      <p className="mb-4 text-xs text-[var(--on-surface-variant)]">
        ¿Ya se gastó o se tiró? Selecciona las etiquetas y márcalas como consumidas o
        desechadas: dejan de avisar y quedan en el registro APPCC.
      </p>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {retirement === 'retired'
            ? 'No hay etiquetas retiradas.'
            : onlyExpiring
              ? 'No hay nada próximo a caducar.'
              : retirement === 'active'
                ? 'No hay etiquetas activas: todo está consumido o desechado.'
                : 'No hay etiquetas emitidas todavía.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-container-high)] text-left text-[var(--on-surface-variant)]">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todas las de esta página"
                    checked={allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={toggleAll}
                    className="h-5 w-5"
                  />
                </th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Creación</th>
                <th className="px-3 py-2">Caducidad</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const effectiveExpiry = r.frozenUseByDate ?? r.useByDate;
                const isAlert = r.expiryStatus === 'expiring_soon' || r.expiryStatus === 'expired';
                const isRetired = Boolean(r.retiredAt);
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/dashboard/etiquetado/${r.id}`)}
                    className={`cursor-pointer border-t border-[var(--outline-variant)] hover:bg-[var(--surface-container)] ${isRetired ? 'text-[var(--on-surface-variant)]' : ''}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {!isRetired && (
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${r.itemName}`}
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          className="h-5 w-5"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">{r.itemName}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{r.lotNumber}</td>
                    <td className="px-3 py-2">
                      {r.labelType === 'ELABORATED' ? 'Elaboración' : 'Artículo'}
                    </td>
                    <td className="px-3 py-2">{fmtDate(r.preparedAt)}</td>
                    <td className={`px-3 py-2 ${isAlert ? 'text-error font-semibold' : ''}`}>
                      {fmtDate(effectiveExpiry)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          isAlert
                            ? 'rounded-full bg-error/10 px-2 py-0.5 text-xs font-semibold text-error'
                            : 'rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-xs text-[var(--on-surface-variant)]'
                        }
                      >
                        {statusText(r)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => goToPage(Math.max(1, page - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-[var(--on-surface-variant)]">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {selected.size > 0 && (
        <RetireSelectionBar
          selectedIds={[...selected]}
          onDone={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
