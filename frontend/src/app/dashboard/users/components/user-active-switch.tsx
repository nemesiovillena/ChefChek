'use client';

interface UserActiveSwitchProps {
  name: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/** Interruptor Activo/Desactivado de una persona o dispositivo en Equipo. */
export function UserActiveSwitch({ name, active, disabled, onToggle }: UserActiveSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${active ? 'Desactivar' : 'Activar'} a ${name}`}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full pr-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          active ? 'bg-green-600' : 'bg-[var(--outline)]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-[#fff] shadow transition-transform ${
            active ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className={active ? 'text-green-700 dark:text-green-400' : 'text-[var(--on-surface-variant)]'}>
        {active ? 'Activo' : 'Desactivado'}
      </span>
    </button>
  );
}
