import Image from 'next/image';

// Pictogramas oficiales de alérgenos (Reglamento UE 1169/2011) servidos
// desde public/images/allergens. Las claves son los ids del catálogo BD
// (/api/v1/allergens), cuyo orden NO coincide con la numeración canónica
// UE: aquí 10=Sésamo, 11=Sulfitos, 12=Altramuces, 14=Frutos de Cáscara.
const ALLERGEN_ICON_SRC: Record<number, string> = {
  1: '/images/allergens/gluten-derivados-300x300.webp',
  2: '/images/allergens/crustaceos-300x300.webp',
  3: '/images/allergens/huevos-300x300.webp',
  4: '/images/allergens/pescados-300x300.webp',
  5: '/images/allergens/cacahuetes-300x300.webp',
  6: '/images/allergens/soja-300x300.webp',
  7: '/images/allergens/lacteos-300x300.webp',
  8: '/images/allergens/apio-300x300.webp',
  9: '/images/allergens/mostaza-300x300.webp',
  10: '/images/allergens/granos-sesamo-300x300.webp',
  11: '/images/allergens/dioxido-azufre-sulfitos-300x300.webp',
  12: '/images/allergens/altramuces-300x300.webp',
  13: '/images/allergens/moluscos-300x300.webp',
  14: '/images/allergens/cascaras-frutos-secos-300x300.webp',
};

interface AllergenIconProps {
  id: number;
  name?: string;
  /** Emoji del catálogo BD; solo se usa como fallback si el id no tiene pictograma. */
  icon?: string;
  size?: number;
  className?: string;
}

export default function AllergenIcon({ id, name, icon, size = 24, className }: AllergenIconProps) {
  const src = ALLERGEN_ICON_SRC[id];
  if (!src) {
    return (
      <span
        className={className}
        style={{ fontSize: Math.round(size * 0.8), lineHeight: 1 }}
        aria-hidden={name ? undefined : true}
        title={name}
      >
        {icon || '⚠️'}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={name ?? `Alérgeno ${id}`}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
