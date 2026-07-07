'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, BookOpen } from 'lucide-react';
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

interface SubRecipeOption {
  id: string;
  name: string;
}

interface SubRecipeComboboxProps {
  /** Recetas candidatas (ya filtradas por quien llama: sin la actual ni inactivas). */
  items: SubRecipeOption[];
  /** id de la sub-receta seleccionada. */
  value: string;
  /** Nombre a mostrar en el trigger cuando hay selección. */
  label?: string;
  /** Recibe la opción elegida. */
  onSelect: (item: SubRecipeOption) => void;
  placeholder?: string;
}

/**
 * Combobox de sub-recetas con filtro en cliente. A diferencia de
 * `ProductCombobox` (server-side), aquí el listado es pequeño (otras recetas
 * activas, ya cargadas en la página), así que cmdk filtra localmente.
 */
export default function SubRecipeCombobox({
  items,
  value,
  label,
  onSelect,
  placeholder = 'Buscar receta...',
}: SubRecipeComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex-1 inline-flex items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--on-surface)]/5 font-normal focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {value && label ? (
            <>
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Escribe para buscar..." />
          <CommandList>
            <CommandEmpty>No se encontró receta</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{item.name}</span>
                  <Check
                    className={cn(
                      'ml-1 h-4 w-4 shrink-0',
                      value === item.id ? 'opacity-100' : 'opacity-0',
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
