'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  useCuinerProducts,
  useCuinerSuppliers,
  useDeleteCuinerProductMap,
  useDeleteCuinerSupplierMap,
  useSetCuinerProductMap,
  useSetCuinerSupplierMap,
} from '@/hooks/use-cuiner';
import { CuinerLinkCell, Pager, inputCls } from './cuiner-link-cell';

function useErrorToast() {
  const notify = useNotification();
  return (err: unknown) =>
    notify({ type: 'error', title: 'No se pudo guardar el enlace', message: err instanceof Error ? err.message : '' });
}

export function CuinerSuppliersTab() {
  const { data, isLoading, error } = useCuinerSuppliers();
  const setMap = useSetCuinerSupplierMap();
  const deleteMap = useDeleteCuinerSupplierMap();
  const onError = useErrorToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlyUnmapped, setOnlyUnmapped] = useState(true);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      onError(err);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-gray-400" />;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows = (data ?? []).filter((r) => !onlyUnmapped || !r.mapped);
  const pending = (data ?? []).filter((r) => !r.mapped).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {pending} de {data?.length ?? 0} proveedores sin enlazar. Un albarán solo se puede enviar si su proveedor
          está enlazado.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnmapped} onChange={(e) => setOnlyUnmapped(e.target.checked)} />
          Solo sin enlazar
        </label>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.supplierId} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
            <div>
              <p className="font-medium">{row.name}</p>
              {row.cifNif && <p className="text-xs text-gray-500">{row.cifNif}</p>}
            </div>
            <CuinerLinkCell
              kind="supplier"
              searchSeed={row.name}
              mapped={row.mapped}
              suggestion={row.suggestion}
              busy={busyId === row.supplierId}
              onLink={(codigo) =>
                run(row.supplierId, () => setMap.mutateAsync({ supplierId: row.supplierId, codigo }))
              }
              onUnlink={() => run(row.supplierId, () => deleteMap.mutateAsync(row.supplierId))}
            />
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-center text-sm text-gray-500">Todo enlazado.</li>}
      </ul>
    </div>
  );
}

export function CuinerProductsTab() {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(true);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCuinerProducts({ search, onlyUnmapped, page });
  const setMap = useSetCuinerProductMap();
  const deleteMap = useDeleteCuinerProductMap();
  const onError = useErrorToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      onError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          className={`${inputCls} max-w-sm`}
          placeholder="Buscar artículo de ChefChek"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(draft.trim());
              setPage(1);
            }
          }}
          onBlur={() => {
            setSearch(draft.trim());
            setPage(1);
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyUnmapped}
            onChange={(e) => {
              setOnlyUnmapped(e.target.checked);
              setPage(1);
            }}
          />
          Solo sin enlazar
        </label>
      </div>
      <p className="mb-2 text-sm text-gray-600 dark:text-zinc-400">
        Cada línea de un albarán necesita su artículo enlazado al código de Cuiner para poder enviarse.
      </p>

      {isLoading && <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {data && (
        <>
          <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
            {data.items.map((row) => (
              <li key={row.productId} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
                <p className="font-medium">{row.name}</p>
                <CuinerLinkCell
                  kind="article"
                  searchSeed={row.name}
                  mapped={row.mapped}
                  suggestion={row.suggestion}
                  busy={busyId === row.productId}
                  onLink={(articulo) =>
                    run(row.productId, () => setMap.mutateAsync({ productId: row.productId, articulo }))
                  }
                  onUnlink={() => run(row.productId, () => deleteMap.mutateAsync(row.productId))}
                />
              </li>
            ))}
            {data.items.length === 0 && (
              <li className="py-6 text-center text-sm text-gray-500">
                {onlyUnmapped && search
                  ? 'Sin resultados entre los artículos sin enlazar. Desmarca «Solo sin enlazar» para buscar también en los ya enlazados.'
                  : 'Sin resultados.'}
              </li>
            )}
          </ul>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
