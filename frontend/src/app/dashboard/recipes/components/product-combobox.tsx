'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProductSearch } from '@/hooks/use-product-search';

/**
 * Producto que el combobox entrega al seleccionar. Incluye `allergens` para que
 * la receta pueda auto-añadirlos SIN depender del listado completo de productos
 * (la búsqueda es server-side y puede traer items fuera de la primera página).
 */
export interface ComboboxProduct {
  id: string;
  name: string;
  referenceUnit?: string;
  allergens?: number[];
}

interface ProductComboboxProps {
  /** id del producto actualmente seleccionado. */
  value: string;
  /** Nombre a mostrar en el trigger cuando hay selección (lo provee la receta,
   *  no la búsqueda, para que se vea aunque el producto no esté en resultados). */
  label?: string;
  /** Recibe el producto completo al elegirlo del listado. */
  onSelect: (product: ComboboxProduct) => void;
  placeholder?: string;
}

/**
 * Combobox de ingredientes con búsqueda server-side (debounced) vía
 * `useProductSearch`. Reemplaza al <select> nativo: el usuario escribe y filtra
 * contra TODA la base de productos, no sólo los primeros 50 cargados en cliente.
 */
export default function ProductCombobox({
  value,
  label,
  onSelect,
  placeholder = 'Buscar ingrediente...',
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const { products, loading, search, setSearch } = useProductSearch();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex-1 inline-flex items-center justify-between gap-2 rounded-md border border-input bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-accent font-normal">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {value && label ? (
            <>
              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {/* shouldFilter={false}: los resultados los aporta el servidor; cmdk sólo
            aporta navegación por teclado y estados vacíos. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Escribe para buscar..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : products.length === 0 ? (
              <CommandEmpty>
                {search.trim() ? 'No se encontró ingrediente' : 'Escribe para buscar'}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      onSelect({
                        id: product.id,
                        name: product.name,
                        referenceUnit: product.referenceUnit,
                        allergens: product.allergens,
                      });
                      setOpen(false);
                    }}
                  >
                    <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{product.name}</span>
                    {product.referenceUnit && (
                      <span className="text-xs text-muted-foreground">
                        ({product.referenceUnit})
                      </span>
                    )}
                    <Check
                      className={cn(
                        'ml-1 h-4 w-4 shrink-0',
                        value === product.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
