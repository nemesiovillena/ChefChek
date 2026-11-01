'use client';

import { usePurchaseLists } from '@/hooks/use-purchase-lists';

interface PedidosListsPickerProps {
  value: string[];
  onChange: (listIds: string[]) => void;
}

/**
 * Listas de compra con las que una persona puede hacer pedidos. Solo verá
 * esas listas, sus programaciones y los pedidos de sus proveedores.
 */
export function PedidosListsPicker({ value, onChange }: PedidosListsPickerProps) {
  const { data: lists, isLoading } = usePurchaseLists();

  const toggle = (listId: string, checked: boolean) => {
    onChange(checked ? [...value, listId] : value.filter((id) => id !== listId));
  };

  if (isLoading) {
    return <p className="text-xs text-gray-500">Cargando listas…</p>;
  }
  if (!lists?.length) {
    return (
      <p className="text-xs text-gray-500">
        Aún no hay listas de compra. Créalas en Almacén → Compras → Listas.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500">
        Listas con las que puede pedir. Verá esas listas y los pedidos de sus proveedores.
        {value.length === 0 && ' Sin ninguna marcada no verá nada.'}
      </p>
      <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-zinc-700 p-2 space-y-1">
        {lists.map((list) => (
          <label key={list.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={value.includes(list.id)}
              onChange={(e) => toggle(list.id, e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span>
              {list.name}
              {list.supplier?.name && <span className="text-gray-500"> · {list.supplier.name}</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
