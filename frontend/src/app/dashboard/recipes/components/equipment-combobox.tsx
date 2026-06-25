'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const EQUIPMENT_OPTIONS = [
  'molde', 'horno', 'thermomix', 'mezclar', 'batidora',
  'sartén', 'olla', 'varillas', 'espátula', 'manga pastelera',
  'abatidor', 'estufa', 'freidora', 'vaporero', 'griddle',
  'salamandra', 'microondas', 'cámara', 'marmita', 'turmix',
];

interface EquipmentComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

export default function EquipmentCombobox({ value, onValueChange }: EquipmentComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground font-normal"
      >
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span className="text-muted-foreground">Equipo</span>
        )}
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            if (itemValue.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder="Buscar equipo..." />
          <CommandList>
            <CommandEmpty>No encontrado</CommandEmpty>
            <CommandGroup>
              {EQUIPMENT_OPTIONS.map((eq) => (
                <CommandItem
                  key={eq}
                  value={eq}
                  onSelect={() => {
                    onValueChange(eq);
                    setOpen(false);
                  }}
                >
                  <span>{eq}</span>
                  <Check className={cn('ml-auto h-4 w-4', value === eq ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
