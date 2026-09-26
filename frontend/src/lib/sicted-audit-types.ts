/** Tipos del pack de auditoría (SICTED fase 5) — espejo de `backend/src/modules/sicted/services/sicted-coverage.service.ts`. */

export interface CoverageGap {
  templateId: string;
  templateName: string;
  area: string;
  periodKey: string;
  status: 'MISSING' | 'INCOMPLETE';
  runId?: string;
}

export interface CoverageReport {
  from: string;
  to: string;
  expected: number;
  completed: number;
  validated: number;
  gaps: CoverageGap[];
}
