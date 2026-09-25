'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Archive, ClipboardCheck, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  useArchiveSictedTemplate,
  useSeedSictedStarterTemplates,
  useSictedTemplates,
} from '@/hooks/use-sicted';
import { CHECKLIST_MODE_LABELS, type ChecklistTemplate } from '@/lib/sicted-types';
import { SictedTemplateEditor } from '../components/sicted-template-editor';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/** Editor de Plan: listado de plantillas + crear/editar/archivar. Solo ADMIN/OWNER (guard también en backend). */
export default function SictedPlanPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const confirm = useConfirm();
  const notify = useNotification();
  const { data: templates, isLoading } = useSictedTemplates();
  const archive = useArchiveSictedTemplate();
  const seedStarter = useSeedSictedStarterTemplates();

  const [editing, setEditing] = useState<ChecklistTemplate | 'new' | null>(null);

  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  if (authLoading || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">Solo encargados pueden editar el Plan.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>
        <h2 className="font-headline-lg text-headline-lg text-primary mb-4">
          {editing === 'new' ? 'Nueva plantilla' : editing.name}
        </h2>
        <SictedTemplateEditor
          template={editing === 'new' ? null : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  async function handleArchive(t: ChecklistTemplate) {
    const ok = await confirm({
      title: 'Archivar plantilla',
      description: `"${t.name}" dejará de generar hojas nuevas. Las hojas ya generadas se conservan.`,
      confirmText: 'Archivar',
      variant: 'destructive',
      onConfirm: async () => {
        await archive.mutateAsync(t.id);
        notify({ type: 'success', title: 'Archivada', message: t.name });
      },
    });
    if (!ok) return;
  }

  async function handleSeedStarter() {
    try {
      const created = await seedStarter.mutateAsync();
      notify({ type: 'success', title: 'Plantillas de ejemplo cargadas', message: `${created.length} plantilla(s).` });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.push('/dashboard/sicted')}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a SICTED
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-headline-lg text-headline-lg text-primary">El Plan</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={seedStarter.isPending}
            onClick={handleSeedStarter}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium disabled:opacity-40"
          >
            <ClipboardCheck className="h-4 w-4" />
            Cargar plantillas de ejemplo
          </button>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </button>
        </div>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          Sin plantillas todavía.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3"
            >
              <button type="button" onClick={() => setEditing(t)} className="flex-1 text-left">
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {t.area} · {CHECKLIST_MODE_LABELS[t.mode]} · v{t.version}
                  {t.usedByModules.length > 1 && ` · compartida (${t.usedByModules.join(', ')})`}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleArchive(t)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--error)] hover:bg-[var(--error-container)]"
                aria-label="Archivar"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
