'use client';

/**
 * Abecedario táctil del listado de recetas: pensado para el monitor de cocina,
 * que no tiene teclado. Pulsar una letra filtra por la primera letra del
 * nombre; pulsarla otra vez (o «Todas») quita el filtro. Las letras sin
 * recetas con los filtros actuales salen atenuadas y no se pueden pulsar.
 */
const LETTERS = [...'ABCDEFGHIJKLMN', 'Ñ', ...'OPQRSTUVWXYZ'];

interface RecipeAlphabetBarProps {
  selected: string;
  /** Letras con recetas; undefined mientras carga (todas activas). */
  available?: string[];
  onSelect: (letter: string) => void;
}

const baseButton =
  'min-h-[44px] min-w-[44px] rounded-lg px-2 text-base font-semibold transition-colors select-none';
const activeButton = 'bg-primary text-primary-foreground';
const idleButton =
  'border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] hover:bg-[var(--surface-container)]';

export function RecipeAlphabetBar({ selected, available, onSelect }: RecipeAlphabetBarProps) {
  const availableSet = available ? new Set(available) : null;

  return (
    // role="toolbar" en un <div>: globals.css oculta los <nav> no fijos.
    <div role="toolbar" aria-label="Filtrar por letra" className="mb-6 flex flex-wrap gap-1.5">
      <button
        type="button"
        aria-pressed={!selected}
        onClick={() => onSelect('')}
        className={`${baseButton} px-3 ${!selected ? activeButton : idleButton}`}
      >
        Todas
      </button>
      {LETTERS.map((letter) => {
        const isSelected = selected === letter;
        // La letra elegida queda pulsable aunque ya no tenga recetas, para poder quitarla.
        const isEmpty = !isSelected && availableSet !== null && !availableSet.has(letter);
        return (
          <button
            key={letter}
            type="button"
            aria-pressed={isSelected}
            disabled={isEmpty}
            onClick={() => onSelect(isSelected ? '' : letter)}
            className={`${baseButton} ${isSelected ? activeButton : idleButton} disabled:cursor-not-allowed disabled:opacity-30`}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
