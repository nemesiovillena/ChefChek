'use client';

import { useState } from 'react';
import { Check, Loader2, MapPin, Pencil } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useSictedTemplates } from '@/hooks/use-sicted';
import { useUpdateSictedJobProfile } from '@/hooks/use-sicted-personas';
import type { JobProfile } from '@/lib/sicted-personas-types';

/**
 * Áreas de una ficha de puesto: quien tenga este puesto ve en "Hojas" solo las hojas de esas áreas
 * (con "Ver todas" para el resto). Se eligen entre las áreas del Plan para que coincidan con las hojas.
 * Sin áreas = ve todas.
 */
export function SictedJobProfileAreasRow({ profile, canManage }: { profile: JobProfile; canManage: boolean }) {
  const notify = useNotification();
  const { data: templates } = useSictedTemplates();
  const update = useUpdateSictedJobProfile();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(profile.areas);

  // Áreas del Plan + las ya guardadas (por si se renombró un área y quedó alguna antigua).
  const options = [...new Set([...(templates ?? []).map((t) => t.area.trim()), ...profile.areas])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'));

  function toggle(area: string) {
    setSelected((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  async function handleSave() {
    try {
      await update.mutateAsync({ id: profile.id, data: { title: profile.title, areas: selected } });
      notify({ type: 'success', title: 'Áreas guardadas', message: '' });
      setEditing(false);
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-[var(--on-surface-variant)]" />
        {profile.areas.length === 0 ? (
          <span className="text-[var(--on-surface-variant)]">Hojas: todas las áreas</span>
        ) : (
          <span>Hojas de: {profile.areas.join(', ')}</span>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setSelected(profile.areas);
              setEditing(true);
            }}
            className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2 text-xs font-medium"
          >
            <Pencil className="h-3.5 w-3.5" /> Áreas
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--outline-variant)] p-3 text-sm">
      <p className="mb-2 text-[var(--on-surface-variant)]">
        ¿Qué hojas ve este puesto? Sin ninguna marcada, ve todas.
      </p>
      {options.length === 0 ? (
        <p className="mb-2 text-[var(--on-surface-variant)]">Aún no hay áreas en el Plan.</p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          {options.map((area) => {
            const on = selected.includes(area);
            return (
              <button
                key={area}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(area)}
                className={`flex min-h-[36px] items-center gap-1 rounded-full border px-3 text-sm ${
                  on
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground'
                    : 'border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]'
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {area}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={update.isPending}
          onClick={handleSave}
          className="flex min-h-[40px] items-center gap-1 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-[40px] rounded-lg border border-[var(--outline-variant)] px-3 text-sm font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
