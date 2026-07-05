'use client';

import AllergenIcon from './allergen-icon';

// Estándar del proyecto: los alérgenos se representan con los pictogramas
// oficiales UE-1169 (allergen-icon.tsx); el emoji del catálogo BD queda
// solo como fallback para ids sin pictograma.
interface AllergenBadgeProps {
  id: number;
  allergen?: { name: string; icon?: string };
}

export default function AllergenBadge({ id, allergen }: AllergenBadgeProps) {
  return (
    <span
      title={allergen?.name ?? `Alérgeno ${id}`}
      className="inline-flex items-center justify-center w-6 h-6"
    >
      <AllergenIcon id={id} name={allergen?.name} icon={allergen?.icon} size={24} />
    </span>
  );
}
