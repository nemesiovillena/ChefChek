'use client';

import { FileUp, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useImportSictedTemplates } from '@/hooks/use-sicted';
import { normalizeTemplateName } from '@/lib/sicted-plan-file';
import { CHECKLIST_FREQUENCY_LABELS, type ChecklistTemplateInput } from '@/lib/sicted-types';

interface SictedPlanImportDialogProps {
  /** Plantillas leídas del archivo; null = diálogo cerrado. */
  templates: ChecklistTemplateInput[] | null;
  /** Nombres de las plantillas que ya tiene este Plan (se omiten al importar). */
  existingNames: string[];
  onClose: () => void;
}

/**
 * Vista previa de un archivo del Plan antes de importarlo: qué hojas se crean
 * y cuáles se omiten porque ya existen con ese nombre (misma regla que el
 * backend, que es quien decide al final).
 */
export function SictedPlanImportDialog({ templates, existingNames, onClose }: SictedPlanImportDialogProps) {
  const notify = useNotification();
  const importTemplates = useImportSictedTemplates();

  const seen = new Set(existingNames.map(normalizeTemplateName));
  const rows = (templates ?? []).map((t) => {
    const key = normalizeTemplateName(t.name);
    const duplicate = seen.has(key);
    seen.add(key);
    return { template: t, duplicate };
  });
  const newCount = rows.filter((r) => !r.duplicate).length;

  async function handleImport() {
    if (!templates) return;
    try {
      const result = await importTemplates.mutateAsync(templates);
      notify({
        type: 'success',
        title: `${result.created.length} plantilla(s) importada(s)`,
        message: result.skipped.length > 0 ? `Omitidas por existir ya: ${result.skipped.join(', ')}` : '',
      });
      onClose();
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo importar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <Dialog open={templates !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Importar plantillas
          </DialogTitle>
          <DialogDescription>
            Se crearán como plantillas nuevas de este Plan. Las que ya existen con el mismo nombre se omiten.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {rows.map(({ template, duplicate }, index) => (
            <li
              key={`${template.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--outline-variant)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{template.name}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {template.area} · {CHECKLIST_FREQUENCY_LABELS[template.frequency] ?? template.frequency} ·{' '}
                  {template.items.length} tarea(s)
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  duplicate
                    ? 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                    : 'bg-[var(--primary)] text-primary-foreground'
                }`}
              >
                {duplicate ? 'Ya existe · se omite' : 'Nueva'}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 border-t border-[var(--outline-variant)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={newCount === 0 || importTemplates.isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {importTemplates.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {newCount === 0 ? 'Nada que importar' : `Importar ${newCount}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
