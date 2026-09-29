import type { ChecklistTemplate, ChecklistTemplateInput } from '@/lib/sicted-types';

/**
 * Archivo portable del Plan SICTED: lleva plantillas de un tenant a otro (o de
 * dev a producción). Solo la definición de cada hoja — sin ids, tenant, autor
 * ni marcas, que pertenecen al restaurante de origen.
 */
export const PLAN_FILE_FORMAT = 'chefchek-sicted-plan';
export const PLAN_FILE_VERSION = 1;

export interface SictedPlanFile {
  format: typeof PLAN_FILE_FORMAT;
  version: number;
  exportedAt: string;
  templates: ChecklistTemplateInput[];
}

/**
 * Plantilla guardada → datos de alta/edición. `keepItemIds` solo al editar el
 * Plan del propio tenant (conserva la identidad de los ítems y sus marcas);
 * al exportar se omiten porque en el destino son ítems nuevos.
 */
export function templateToInput(template: ChecklistTemplate, { keepItemIds = false } = {}): ChecklistTemplateInput {
  return {
    name: template.name,
    externalCode: template.externalCode ?? undefined,
    kind: template.kind,
    mode: template.mode,
    area: template.area,
    frequency: template.frequency,
    weekday: template.weekday ?? undefined,
    dayOfMonth: template.dayOfMonth ?? undefined,
    responsiblePosition: template.responsiblePosition ?? undefined,
    requiresSupervisor: template.requiresSupervisor,
    practiceRef: template.practiceRef ?? undefined,
    items: template.items.map((i) => ({
      ...(keepItemIds ? { id: i.id } : {}),
      label: i.label,
      itemFrequency: i.itemFrequency ?? undefined,
      procedure: i.procedure ?? undefined,
      products: i.products,
      dosage: i.dosage ?? undefined,
      epi: i.epi ?? undefined,
      isRequired: i.isRequired,
      expectedRangeMin: i.expectedRangeMin ?? undefined,
      expectedRangeMax: i.expectedRangeMax ?? undefined,
      defaultValue: i.defaultValue ?? undefined,
    })),
  };
}

/** Descarga `templates` como archivo JSON del Plan. */
export function downloadPlanFile(templates: ChecklistTemplate[]) {
  const file: SictedPlanFile = {
    format: PLAN_FILE_FORMAT,
    version: PLAN_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    templates: templates.map((t) => templateToInput(t)),
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plan-sicted-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lee un archivo del Plan. Solo comprueba la forma general (formato, versión,
 * lista de plantillas con nombre e ítems); la validación campo a campo la hace
 * el backend con el mismo DTO que el alta manual.
 */
export function parsePlanFile(text: string): ChecklistTemplateInput[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const file = data as Partial<SictedPlanFile> | null;
  if (!file || file.format !== PLAN_FILE_FORMAT) {
    throw new Error('Este archivo no es una exportación del Plan SICTED de ChefChek.');
  }
  if (file.version !== PLAN_FILE_VERSION) {
    throw new Error(`Versión de archivo no compatible (${String(file.version)}).`);
  }
  const templates = Array.isArray(file.templates) ? file.templates : [];
  const valid = templates.every(
    (t) => t && typeof t.name === 'string' && t.name.trim() && Array.isArray(t.items) && t.items.length > 0,
  );
  if (templates.length === 0 || !valid) {
    throw new Error('El archivo no contiene plantillas válidas.');
  }
  return templates;
}

/** Misma normalización que el backend para detectar nombres ya existentes. */
export function normalizeTemplateName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
