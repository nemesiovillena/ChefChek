'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CategoryTreeNode } from '@/hooks/use-categories';

interface CategoryComboboxProps {
  tree: CategoryTreeNode[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

/** Find label and color for a selected value by searching the tree */
function findInTree(tree: CategoryTreeNode[], value: string) {
  for (const parent of tree) {
    if (parent.id === value) return { name: parent.name, color: parent.color };
    const child = parent.children?.find((c) => c.id === value);
    if (child) return { name: child.name, color: child.color || parent.color };
  }
  return null;
}

export default function CategoryCombobox({
  tree,
  value,
  onValueChange,
  placeholder = 'Seleccionar categoría...',
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? findInTree(tree, value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground font-normal text-left cursor-pointer"
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            {selected.color && (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selected.color }}
              />
            )}
            {selected.name}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoría..." />
          <CommandList>
            <CommandEmpty>No se encontró categoría</CommandEmpty>
            {/* Clear selection */}
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onValueChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                Todas las categorías
              </CommandItem>
            </CommandGroup>
            {tree.map((parent) => {
              const hasChildren = parent.children && parent.children.length > 0;

              if (!hasChildren) {
                // Parent without children → selectable directly
                return (
                  <CommandGroup key={parent.id}>
                    <CommandItem
                      value={parent.name}
                      onSelect={() => {
                        onValueChange(parent.id);
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {parent.color && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: parent.color }}
                          />
                        )}
                        {parent.name}
                      </span>
                      <Check className={cn('ml-auto h-4 w-4', value === parent.id ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  </CommandGroup>
                );
              }

              // Parent with children → group heading (not selectable), only children selectable
              return (
                <CommandGroup key={parent.id} heading={parent.name}>
                  {parent.children.map((child) => (
                    <CommandItem
                      key={child.id}
                      value={child.name}
                      onSelect={() => {
                        onValueChange(child.id);
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2 pl-3">
                        {child.color && (
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: child.color }}
                          />
                        )}
                        {child.name}
                      </span>
                      <Check className={cn('ml-auto h-4 w-4', value === child.id ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
