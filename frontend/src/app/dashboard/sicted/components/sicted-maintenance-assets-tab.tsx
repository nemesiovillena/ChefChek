'use client';

import { useState } from 'react';
import { Archive, ClipboardCheck, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useArchiveSictedAsset, useSeedSictedStarterAssets, useSictedAssets } from '@/hooks/use-sicted-maintenance';
import { CHECKLIST_ASSET_CATEGORY_LABELS, type ChecklistAsset } from '@/lib/sicted-maintenance-types';
import { SictedAssetEditor } from './sicted-asset-editor';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/** Inventario de equipos: listar, crear/editar/archivar (solo ADMIN/OWNER). */
export function SictedMaintenanceAssetsTab() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const notify = useNotification();
  const { data: assets, isLoading } = useSictedAssets();
  const archive = useArchiveSictedAsset();
  const seedStarter = useSeedSictedStarterAssets();
  const [editing, setEditing] = useState<ChecklistAsset | 'new' | null>(null);

  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (editing) {
    return (
      <div>
        <h3 className="mb-4 font-semibold">{editing === 'new' ? 'Nuevo equipo' : editing.name}</h3>
        <SictedAssetEditor
          asset={editing === 'new' ? null : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  async function handleArchive(a: ChecklistAsset) {
    const ok = await confirm({
      title: 'Archivar equipo',
      description: `"${a.name}" dejará de aparecer en el calendario. Sus revisiones ya registradas se conservan.`,
      confirmText: 'Archivar',
      variant: 'destructive',
      onConfirm: async () => {
        await archive.mutateAsync(a.id);
        notify({ type: 'success', title: 'Archivado', message: a.name });
      },
    });
    if (!ok) return;
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={seedStarter.isPending}
            onClick={async () => {
              const created = await seedStarter.mutateAsync();
              notify({ type: 'success', title: 'Equipo de ejemplo cargado', message: `${created.length} equipo(s).` });
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium disabled:opacity-40"
          >
            <ClipboardCheck className="h-4 w-4" />
            Cargar extintores de ejemplo
          </button>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Nuevo equipo
          </button>
        </div>
      )}

      {!assets || assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          Sin equipos todavía.
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3"
            >
              <button type="button" onClick={() => canManage && setEditing(a)} className="flex-1 text-left">
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {CHECKLIST_ASSET_CATEGORY_LABELS[a.category]}
                  {a.location && ` · ${a.location}`}
                  {a.usedByModules.length > 1 && ` · compartido (${a.usedByModules.join(', ')})`}
                </p>
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleArchive(a)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--error)] hover:bg-[var(--error-container)]"
                  aria-label="Archivar"
                >
                  <Archive className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
