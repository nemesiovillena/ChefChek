'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Product {
  id: string;
  name: string;
  purchaseFormat?: string;
  referenceUnit?: string;
  unitsPerFormat?: number;
  referenceUnitSize?: number;
  unitSize?: number;
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function ProductCombobox({
  products,
  value,
  onValueChange,
  placeholder = 'Buscar ingrediente...',
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedProduct = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground font-normal"
      >
        {selectedProduct ? (
          <span className="flex items-center gap-2 truncate">
            <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {selectedProduct.name}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Escribe para buscar..." />
          <CommandList>
            <CommandEmpty>No se encontró ingrediente</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onValueChange(product.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    {product.name}
                    {product.referenceUnit && (
                      <span className="text-xs text-muted-foreground">
                        ({product.referenceUnit})
                      </span>
                    )}
                  </span>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      value === product.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
