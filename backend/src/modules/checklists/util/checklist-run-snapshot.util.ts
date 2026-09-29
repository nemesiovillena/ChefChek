/**
 * Foto de la plantilla que se congela en cada hoja al crearse: editar el Plan
 * mañana no reescribe el historial de una hoja ya trabajada.
 */
export interface ChecklistRunSnapshot {
  templateName: string;
  version: number;
  mode: string;
  requiresSupervisor: boolean;
  items: {
    id: string;
    label: string;
    isRequired: boolean;
    expectedRangeMin: number | null;
    expectedRangeMax: number | null;
  }[];
}

export function buildChecklistRunSnapshot(template: {
  name: string;
  version: number;
  mode: string;
  requiresSupervisor: boolean;
  items: ChecklistRunSnapshot["items"];
}): ChecklistRunSnapshot {
  return {
    templateName: template.name,
    version: template.version,
    mode: template.mode,
    requiresSupervisor: template.requiresSupervisor,
    items: template.items.map((i) => ({
      id: i.id,
      label: i.label,
      isRequired: i.isRequired,
      expectedRangeMin: i.expectedRangeMin,
      expectedRangeMax: i.expectedRangeMax,
    })),
  };
}
