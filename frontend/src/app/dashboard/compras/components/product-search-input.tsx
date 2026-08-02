'use client';

import { useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { useProductSearch } from '@/hooks/use-product-search';

export interface PickedProduct {
  id: string;
  name: string;
  referenceUnit?: string;
  purchaseFormat?: string;
}

/**
 * Buscador compacto de artículos (server-side vía useProductSearch — nunca
 * useProducts, que pagina). Devuelve el producto completo en onSelect.
 * Con `supplierId` solo ofrece artículos de ese proveedor: los pedidos y
 * listas de compra son siempre por proveedor.
 */
export function ProductSearchInput({
  onSelect,
  supplierId,
  excludeIds = [],
  placeholder = 'Buscar artículo del proveedor...',
  showAddButton = false,
}: {
  onSelect: (product: PickedProduct) => void;
  supplierId?: string;
  excludeIds?: string[];
  placeholder?: string;
  /** Muestra un botón "+" que añade la primera coincidencia sin abrir el desplegable; Enter hace lo mismo. Pensado para altas rápidas y sucesivas. */
  showAddButton?: boolean;
}) {
  const { products, loading, search, setSearch } = useProductSearch(300, {
    supplierId,
  });
  const [open, setOpen] = useState(false);

  const visible = products.filter((p) => !excludeIds.includes(p.id));
  const topMatch = visible[0];

  const addTopMatch = () => {
    if (!topMatch) return;
    onSelect({
      id: topMatch.id,
      name: topMatch.name,
      referenceUnit: topMatch.referenceUnit,
      purchaseFormat: topMatch.purchaseFormat,
    });
    setSearch('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (showAddButton && e.key === 'Enter') {
            e.preventDefault();
            addTopMatch();
          }
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-2 pl-9 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)] ${showAddButton ? 'pr-11' : 'pr-3'}`}
      />
      {loading && (
        <Loader2
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--on-surface-variant)] ${showAddButton ? 'right-11' : 'right-3'}`}
        />
      )}
      {showAddButton && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addTopMatch}
          disabled={!topMatch}
          aria-label="Añadir artículo a la lista"
          title={topMatch ? `Añadir "${topMatch.name}"` : 'Escribe para buscar un artículo'}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[var(--primary)] text-primary-foreground transition disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
      {open && search.trim() && visible.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-lg">
          {visible.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                // onMouseDown para ganar al onBlur del input
                onMouseDown={() => {
                  onSelect({
                    id: product.id,
                    name: product.name,
                    referenceUnit: product.referenceUnit,
                    purchaseFormat: product.purchaseFormat,
                  });
                  setSearch('');
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
              >
                {product.name}
                {product.purchaseFormat ? (
                  <span className="ml-2 text-xs text-[var(--on-surface-variant)]">
                    {product.purchaseFormat}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
