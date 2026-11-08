'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, Soup, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlphabetFilterBar, initialLetter } from '@/components/alphabet-filter-bar';
import { foldAccents } from '@/lib/utils';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import { usePortionOverview, type PortionCounter, type PortionState } from '@/hooks/use-raciones';
import { PortionCounterCard } from './components/portion-counter-card';
import { PortionAdjustDialog, type AdjustMode } from './components/portion-adjust-dialog';
import { PortionCounterCreateDialog } from './components/portion-counter-create-dialog';
import { PortionCounterDetailDialog } from './components/portion-counter-detail-dialog';
import { ExpiredPortionsPanel, ShortfallPanel } from './components/portion-review-panels';

export const dynamic = 'force-dynamic';

/** Agotados primero, luego los que quedan pocos, luego por nombre. */
const STATE_ORDER: Record<PortionState, number> = { out: 0, low: 1, ok: 2 };

const NO_CATEGORY = 'Sin categoría';

/** Agrupa por categoría en orden alfabético; los que no tienen, al final. */
function groupByCategory(list: PortionCounter[]) {
  const groups = new Map<string, PortionCounter[]>();
  for (const c of list) {
    const key = c.category?.trim() || NO_CATEGORY;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b, 'es'),
  );
}

/** Con pocos contadores las 27 letras ocupan más que la lista: solo buscador. */
const MIN_COUNTERS_FOR_ALPHABET = 12;

/** Busca por el nombre del contador y por el de los platos de Cuiner enlazados (como se llaman en el TPV). */
const matchesSearch = (c: PortionCounter, query: string) =>
  [c.name, ...c.dishes.map((d) => d.name ?? '')].some((n) => foldAccents(n).includes(query));

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * Contador de raciones disponibles (sustituye la hoja de papel). Las raciones
 * suben al etiquetar, bajan con lo cobrado en Cuiner, las retiradas y los
 * ajustes, y avisan en la campana cuando quedan pocas.
 */
export default function RacionesPage() {
  const { canSee } = useSectionAccess();
  const canManage = canSee('raciones.manage');
  const { data, isLoading } = usePortionOverview();

  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<{
    id: string;
    mode: AdjustMode;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState('');

  const counters = useMemo(() => data?.counters ?? [], [data]);
  const byId = useMemo(() => new Map(counters.map((c) => [c.id, c])), [counters]);
  const active = useMemo(
    () =>
      counters
        .filter((c) => c.active)
        .sort(
          (a, b) =>
            STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name, 'es'),
        ),
    [counters],
  );
  const query = foldAccents(search.trim());
  const searched = useMemo(
    () => (query ? active.filter((c) => matchesSearch(c, query)) : active),
    [active, query],
  );
  const visible = letter ? searched.filter((c) => initialLetter(c.name) === letter) : searched;
  const groups = groupByCategory(visible);
  // Sugerencias del campo «Categoría» de la ficha: las que ya se usan.
  const categories = useMemo(
    () =>
      [...new Set(counters.map((c) => c.category?.trim()).filter((c): c is string => !!c))].sort(
        (a, b) => a.localeCompare(b, 'es'),
      ),
    [counters],
  );
  const availableLetters = useMemo(
    () => [...new Set(searched.map((c) => initialLetter(c.name)))],
    [searched],
  );
  const showAlphabet = active.length >= MIN_COUNTERS_FOR_ALPHABET;
  const hasFilters = Boolean(query || letter);
  const clearFilters = () => {
    setSearch('');
    setLetter('');
  };
  const inactive = counters.filter((c) => !c.active);
  const openCounter: PortionCounter | undefined = openId ? byId.get(openId) : undefined;
  const adjustCounter = adjusting ? byId.get(adjusting.id) : undefined;

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-28 pt-4 md:pt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">
            Cocina y sala
          </span>
          <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">
            Contador de platos
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {data?.cuinerCheckedAt
              ? `Enlazado con el Contador de platos de Cuiner: descuenta al pedir. Comprobado a las ${fmtDateTime(data.cuinerCheckedAt)}.`
              : data?.salesReceivedUntil
                ? `Ventas de Cuiner cobradas hasta ${fmtDateTime(data.salesReceivedUntil)}. Lo pedido sin cobrar aún no descuenta.`
                : 'Aún no han llegado ventas de Cuiner.'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} className="min-h-[44px]">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo contador
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <>
          <ExpiredPortionsPanel labels={data?.expiredLabels ?? []} />
          <ShortfallPanel shortfalls={data?.shortfalls ?? []} />

          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
              <Soup className="mx-auto mb-2 h-8 w-8 opacity-50" />
              {canManage
                ? 'Aún no hay platos con contador. Crea uno con «Nuevo contador» (ej. solomillo, lubina).'
                : 'Aún no hay platos con contador.'}
            </div>
          ) : (
            <>
              <div className="relative mb-3 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
                <input
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar plato"
                  aria-label="Buscar plato"
                  className="min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-2 pl-9 pr-10 text-base"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Borrar búsqueda"
                    onClick={() => setSearch('')}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full hover:bg-[var(--surface-container-high)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showAlphabet && (
                <AlphabetFilterBar
                  selected={letter}
                  available={availableLetters}
                  onSelect={setLetter}
                />
              )}
              {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-8 text-center text-[var(--on-surface-variant)]">
                  Ningún plato coincide.
                  {hasFilters && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="mt-3 block min-h-[44px] mx-auto"
                    >
                      Quitar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {groups.map(([category, list]) => (
                    <section key={category} aria-label={category}>
                      {/* Sin título si todo está en un solo grupo sin categoría. */}
                      {(groups.length > 1 || category !== NO_CATEGORY) && (
                        <div
                          role="heading"
                          aria-level={3}
                          className="mb-2 flex items-baseline gap-2 border-b border-[var(--outline-variant)] pb-1"
                        >
                          <span className="text-base font-semibold text-primary">{category}</span>
                          <span className="text-sm text-[var(--on-surface-variant)]">{list.length}</span>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((c) => (
                          <PortionCounterCard
                            key={c.id}
                            counter={c}
                            canManage={canManage}
                            onOpen={() => setOpenId(c.id)}
                            onRecount={() => setAdjusting({ id: c.id, mode: 'recount' })}
                            onAdjust={() => setAdjusting({ id: c.id, mode: 'adjust' })}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

          {canManage && inactive.length > 0 && (
            <details className="mt-6">
              <summary className="min-h-[44px] cursor-pointer py-2 text-sm text-[var(--on-surface-variant)]">
                Contadores desactivados ({inactive.length})
              </summary>
              <ul className="mt-2 flex flex-wrap gap-2">
                {inactive.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="min-h-[44px] rounded-lg border border-[var(--outline-variant)] px-3 text-sm hover:bg-[var(--surface-container-high)]"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {creating && (
        <PortionCounterCreateDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            // Que el contador nuevo no quede oculto por un filtro activo.
            clearFilters();
            setOpenId(id);
          }}
        />
      )}
      {openCounter && (
        <PortionCounterDetailDialog
          counter={openCounter}
          categories={categories}
          canManage={canManage}
          onClose={() => setOpenId(null)}
        />
      )}
      {adjusting && adjustCounter && (
        <PortionAdjustDialog
          counter={adjustCounter}
          mode={adjusting.mode}
          onClose={() => setAdjusting(null)}
        />
      )}
    </div>
  );
}
