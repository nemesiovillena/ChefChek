'use client';

import { useState } from 'react';
import Link from 'next/link';
import PaginationControls from '@/components/shared/pagination-controls';
import type { MenuClass } from '../api/gestion-api';
import { MENU_CLASSES, MENU_CLASS_INFO, type MenuDishClassified } from '../api/gestion-menu-engineering-api';
import { formatEuros, formatQty } from '../gestion-format';

const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`);
const th = 'px-2 py-2 text-right font-medium';
const td = 'px-2 py-1.5 text-right tabular-nums';

/** Filtro por clase: todas, una de las cuatro o los que no tienen escandallo. */
type Filter = 'todos' | MenuClass | 'sin-escandallo';

/** Punto de color + nombre de la clase («Sin escandallo» si no la tiene). */
export function MenuClassBadge({ menuClass }: { menuClass: MenuClass | null }) {
  if (!menuClass) return <span className="text-[var(--on-surface-variant)]">Sin escandallo</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: MENU_CLASS_INFO[menuClass].color }} aria-hidden />
      {MENU_CLASS_INFO[menuClass].label}
    </span>
  );
}

/**
 * Todos los platos vendidos de la carta, de todas las familias, con su clase.
 * Cada plato se clasifica frente a los de su familia (como en la matriz), así
 * que un perro de postres y uno de arroces lo son cada uno en su terreno.
 */
export function MenuEngineeringAllDishes({ dishes, canOpenRecipes }: { dishes: MenuDishClassified[]; canOpenRecipes: boolean }) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const count = (f: Filter) =>
    f === 'todos' ? dishes.length : dishes.filter((d) => (f === 'sin-escandallo' ? d.menuClass === null : d.menuClass === f)).length;
  const filtered = filter === 'todos' ? dishes : dishes.filter((d) => (filter === 'sin-escandallo' ? d.menuClass === null : d.menuClass === filter));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  const filters: { id: Filter; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    ...MENU_CLASSES.map((c) => ({ id: c as Filter, label: MENU_CLASS_INFO[c].plural })),
    { id: 'sin-escandallo', label: 'Sin escandallo' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-[var(--on-surface)]">Todos los platos de la carta · {dishes.length}</div>
        <p className="text-xs text-[var(--on-surface-variant)]">
          De todas las familias. Cada plato se clasifica frente a los de su propia familia, igual que en la matriz.
        </p>
      </div>

      <div role="group" aria-label="Filtrar por clasificación" className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === f.id
                ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground'
                : 'border-[var(--outline-variant)] text-[var(--on-surface-variant)]'
            }`}
          >
            {f.label} ({count(f.id)})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm text-[var(--on-surface)]">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              <th className="px-2 py-2 text-left font-medium">Plato</th>
              <th className="px-2 py-2 text-left font-medium">Familia</th>
              <th className={th}>Ventas</th>
              <th className={th}>Ingreso</th>
              <th className={th}>Margen ud.</th>
              <th className={th}>% coste</th>
              <th className="px-2 py-2 text-left font-medium">Clasificación</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.key} className="border-b border-[var(--outline-variant)]">
                <td className="px-2 py-1.5">
                  {canOpenRecipes && d.recipeId ? (
                    <Link
                      href={`/dashboard/recipes?recipe=${d.recipeId}&view=cost`}
                      className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
                    >
                      {d.name}
                    </Link>
                  ) : (
                    d.name
                  )}
                </td>
                <td className="px-2 py-1.5 text-[var(--on-surface-variant)]">{d.group}</td>
                <td className={td}>{formatQty(d.units)}</td>
                <td className={td}>{formatEuros(d.revenue)}</td>
                <td className={td}>{d.margin === null ? '—' : formatEuros(d.margin)}</td>
                <td className={td}>{pct(d.costPct)}</td>
                <td className="px-2 py-1.5 font-semibold">
                  <MenuClassBadge menuClass={d.menuClass} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[var(--on-surface-variant)]">
                  Ningún plato en esta clasificación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 10 && (
        <div className="-mx-4 -mb-4">
          <PaginationControls
            variant="attached"
            page={current}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            emptyLabel="Sin platos"
          />
        </div>
      )}
    </div>
  );
}
