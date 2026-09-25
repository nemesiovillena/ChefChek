/**
 * Tipos de Dirección (SICTED fase 9, sub-PR 1): catálogo de buenas prácticas
 * (BP1-BP6, manual real "Restaurantes y empresas turísticas de catering") y
 * autoevaluación. Escala real: 1-5, sin decimales, + "No aplica" como
 * casilla separada (NO un 6º valor de puntuación).
 */

export interface SictedPractice {
  id: string;
  code: string;
  bpSection: number;
  bpSectionName: string;
  title: string;
  isMandatory: boolean;
  archivedAt: string | null;
}

export interface UpdatePracticeInput {
  title?: string;
  isMandatory?: boolean;
}

export type AssessmentStatus = 'DRAFT' | 'CLOSED';

export interface SictedAssessment {
  id: string;
  label: string;
  assessedAt: string;
  status: AssessmentStatus;
  closedAt: string | null;
}

export interface SictedAssessmentScore {
  id: string;
  assessmentId: string;
  practiceId: string;
  score: number | null;
  notApplicable: boolean;
  evidenceNote: string | null;
}

export interface AssessmentScoreRow {
  practice: SictedPractice;
  score: SictedAssessmentScore | null;
}

export interface UpsertScoreInput {
  score?: number;
  notApplicable?: boolean;
  evidenceNote?: string;
}
