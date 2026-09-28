'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ClipboardCheck, Loader2, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useSeedSictedCatalog,
  useSictedComplementaryGroups,
  useSictedPractices,
  useUpdateSictedPractice,
} from '@/hooks/use-sicted-direccion';
import { groupPracticesByAxisAndModule } from '@/lib/sicted-practice-presentation';
import { SictedPracticeBadges, SictedPracticeDetails } from './sicted-practice-details';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const CATALOG_2026_PREFIX = 'SICTED 2026';

/**
 * Catálogo de buenas prácticas SICTED 2026 de "Restaurantes y empresas de
 * catering", agrupado por eje de sostenibilidad y módulo. Las complementarias
 * se muestran, pero solo cuentan en la autoevaluación si su módulo está
 * activado en Configuración → SICTED.
 */
export function SictedDireccionCatalogTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: practices, isLoading } = useSictedPractices();
  const { data: groups } = useSictedComplementaryGroups();
  const seed = useSeedSictedCatalog();
  const updatePractice = useUpdateSictedPractice();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const enabledModules = useMemo(
    () => new Set((groups ?? []).filter((g) => g.enabled).flatMap((g) => g.moduleCodes)),
    [groups],
  );
  const catalog2026 = useMemo(
    () => (practices ?? []).filter((p) => p.manualVersion.startsWith(CATALOG_2026_PREFIX)),
    [practices],
  );
  const byAxis = useMemo(() => groupPracticesByAxisAndModule(catalog2026, (p) => p), [catalog2026]);
  const hasLegacyOnly = (practices ?? []).length > 0 && catalog2026.length === 0;

  async function handleSeed() {
    try {
      await seed.mutateAsync();
      notify({ type: 'success', title: 'Catálogo SICTED 2026 cargado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

  if (catalog2026.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
        <ClipboardCheck className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="mb-4">
          {hasLegacyOnly
            ? 'El catálogo cargado es el del manual anterior. Actualízalo a la metodología SICTED 2026 (el anterior se archiva, no se borra).'
            : 'Sin catálogo cargado todavía.'}
        </p>
        {canManage && (
          <button
            type="button"
            disabled={seed.isPending}
            onClick={handleSeed}
            className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Cargar catálogo SICTED 2026
          </button>
        )}
      </div>
    );
  }

  const mandatory = catalog2026.filter((p) => p.chapter !== 'COMPLEMENTARIO' && p.isMandatory).length;
  const oficio = catalog2026.filter((p) => p.chapter !== 'COMPLEMENTARIO').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--on-surface-variant)]">
        <p>
          {oficio} prácticas de oficio ({mandatory} obligatorias) + {catalog2026.length - oficio} complementarias · Manual de
          Buenas Prácticas SICTED 2026, Restaurantes y empresas de catering.
        </p>
        <Link href="/dashboard/settings#sicted" className="inline-flex items-center gap-1 font-medium text-[var(--primary)]">
          <Settings className="h-4 w-4" /> Módulos complementarios
        </Link>
      </div>
      <div className="space-y-4">
        {byAxis.map((axis) => (
          <section key={axis.axis}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">{axis.label}</h3>
            <div className="space-y-2">
              {axis.modules.map((mod) => {
                const key = `${axis.axis}-${mod.moduleCode}`;
                const inactive = mod.complementary && !enabledModules.has(mod.moduleCode);
                return (
                  <div
                    key={key}
                    className={`rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] ${inactive ? 'opacity-60' : ''}`}
                  >
                    <button type="button" onClick={() => toggle(key)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
                      <span className="font-medium">
                        {mod.moduleName}{' '}
                        <span className="text-sm font-normal text-[var(--on-surface-variant)]">
                          ({mod.items.length}){mod.complementary ? (inactive ? ' · complementario, no activado' : ' · complementario') : ''}
                        </span>
                      </span>
                      {expanded.has(key) ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    </button>
                    {expanded.has(key) && (
                      <div className="space-y-1 border-t border-[var(--outline-variant)] p-2">
                        {mod.items.map((p) => (
                          <div key={p.id} className="rounded-lg px-2 py-1.5 text-sm">
                            <div className="flex items-start gap-2">
                              <span className="w-12 shrink-0 text-[var(--on-surface-variant)]">{p.code}</span>
                              {editingId === p.id ? (
                                <div className="flex flex-1 gap-2">
                                  <input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="min-h-[36px] flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-base"
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
                              <SictedPracticeBadges practice={p} />
                            </div>
                            <div className="pl-14">
                              <SictedPracticeDetails practice={p} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
