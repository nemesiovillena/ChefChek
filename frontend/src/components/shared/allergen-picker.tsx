'use client';

import AllergenIcon from '@/components/shared/allergen-icon';
import { useAllergens } from '@/hooks/use-allergens';

interface AllergenPickerProps {
  value: number[];
  onChange: (allergens: number[]) => void;
}

/**
 * Rejilla de alérgenos del catálogo con sus pictogramas: pulsar marca o
 * desmarca. Para declarar a mano los alérgenos de algo que no tiene receta
 * ni artículo del que heredarlos.
 */
export default function AllergenPicker({ value, onChange }: AllergenPickerProps) {
  const { allergens: catalog } = useAllergens();

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((a) => a !== id) : [...value, id]);

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {catalog.map((allergen) => {
        const selected = value.includes(allergen.id);
        return (
          <button
            key={allergen.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(allergen.id)}
            title={allergen.name}
            className={`flex flex-col items-center rounded-lg border-2 p-2 transition-colors ${
              selected
                ? 'border-[var(--primary)] bg-[var(--secondary-container)]'
                : 'border-[var(--outline-variant)] hover:border-[var(--outline)]'
            }`}
          >
            <AllergenIcon id={allergen.id} name={allergen.name} icon={allergen.icon} size={32} />
            <span
              className={`mt-1 text-center text-xs leading-tight ${
                selected
                  ? 'font-semibold text-[var(--on-surface)]'
                  : 'text-[var(--on-surface-variant)]'
              }`}
            >
              {allergen.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
