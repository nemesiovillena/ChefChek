'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useSeedSictedCatalog, useSictedPractices, useUpdateSictedPractice } from '@/hooks/use-sicted-direccion';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/** Catálogo de 144 buenas prácticas (BP1-BP6, manual real) — editable/ampliable por el tenant. */
export function SictedDireccionCatalogTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: practices, isLoading } = useSictedPractices();
  const seed = useSeedSictedCatalog();
  const updatePractice = useUpdateSictedPractice();
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const bySection = useMemo(() => {
    const groups = new Map<number, { name: string; items: typeof practices }>();
    for (const p of practices ?? []) {
      if (!groups.has(p.bpSection)) groups.set(p.bpSection, { name: p.bpSectionName, items: [] });
      groups.get(p.bpSection)!.items!.push(p);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [practices]);

  async function handleSeed() {
    try {
      await seed.mutateAsync();
      notify({ type: 'success', title: 'Catálogo cargado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  function toggle(section: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  async function saveEdit(id: string) {
    try {
      await updatePractice.mutateAsync({ id, data: { title: editTitle } });
      setEditingId(null);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!practices || practices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
        <ClipboardCheck className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="mb-4">Sin catálogo cargado todavía.</p>
        {canManage && (
          <button
            type="button"
            disabled={seed.isPending}
            onClick={handleSeed}
            className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Cargar catálogo (144 prácticas)
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--on-surface-variant)]">
        {practices.length} prácticas · Manual &quot;Restaurantes y empresas turísticas de catering&quot;, BP1-BP6.
      </p>
      <div className="space-y-2">
        {bySection.map(([section, group]) => (
          <div key={section} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
            <button
              type="button"
              onClick={() => toggle(section)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-medium">
                BP{section} {group.name} <span className="text-sm text-[var(--on-surface-variant)]">({group.items!.length})</span>
              </span>
              {expanded.has(section) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expanded.has(section) && (
              <div className="space-y-1 border-t border-[var(--outline-variant)] p-2">
                {group.items!.map((p) => (
                  <div key={p.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm">
                    <span className="w-12 shrink-0 text-[var(--on-surface-variant)]">{p.code}</span>
                    {editingId === p.id ? (
                      <div className="flex flex-1 gap-2">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="min-h-[36px] flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-sm"
                        />
                        <button type="button" onClick={() => saveEdit(p.id)} className="text-xs font-medium text-[var(--primary)]">
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => {
                          setEditingId(p.id);
                          setEditTitle(p.title);
                        }}
                        className="flex-1 text-left"
                      >
                        {p.title}
                      </button>
                    )}
                    {p.isMandatory && (
                      <span className="shrink-0 rounded-full bg-[var(--error-container)] px-2 py-0.5 text-xs font-semibold text-[var(--on-error-container)]">
                        Obligatoria
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
