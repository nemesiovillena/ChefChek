'use client';

/**
 * Abecedario táctil (Recetas, Contador de platos): pensado para el monitor de
 * cocina, que no tiene teclado. Pulsar una letra filtra por la primera letra
 * del nombre; pulsarla otra vez (o «Todas») quita el filtro. Las letras sin
 * resultados con los filtros actuales salen atenuadas y no se pueden pulsar.
 */
const LETTERS = [...'ABCDEFGHIJKLMN', 'Ñ', ...'OPQRSTUVWXYZ'];

/** Letra por la que empieza `name`: tildes cuentan como su vocal; Ñ es letra propia (igual que el backend). */
export function initialLetter(name: string): string {
  const first = name.trimStart().charAt(0).toUpperCase();
  return first === 'Ñ' ? 'Ñ' : first.normalize('NFD').charAt(0);
}

export function nameStartsWithLetter(name: string, letter: string): boolean {
  return initialLetter(name) === letter;
}

interface AlphabetFilterBarProps {
  selected: string;
  /** Letras con resultados; undefined mientras carga (todas activas). */
  available?: string[];
  onSelect: (letter: string) => void;
}

const baseButton =
  'min-h-[44px] min-w-[44px] rounded-lg px-2 text-base font-semibold transition-colors select-none';
const activeButton = 'bg-primary text-primary-foreground';
const idleButton =
  'border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] hover:bg-[var(--surface-container)]';

export function AlphabetFilterBar({ selected, available, onSelect }: AlphabetFilterBarProps) {
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
        // La letra elegida queda pulsable aunque ya no tenga resultados, para poder quitarla.
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
