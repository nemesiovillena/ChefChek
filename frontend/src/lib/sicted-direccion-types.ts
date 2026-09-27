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

/**
 * Plan de mejora y objetivos anuales (SICTED fase 9, sub-PR 2).
 */

export type ImprovementActionOrigin = 'ASSESSMENT' | 'EVALUATOR' | 'COMPLAINT' | 'INCIDENT' | 'OTHER';
export type ImprovementActionStatus = 'OPEN' | 'DONE' | 'CANCELLED';

export interface SictedImprovementAction {
  id: string;
  code: number;
  origin: ImprovementActionOrigin;
  sourceRef: string | null;
  title: string;
  detectedAt: string;
  action: string | null;
  responsibleName: string | null;
  dueDate: string | null;
  status: ImprovementActionStatus;
  closedAt: string | null;
  evidenceNote: string | null;
}

export interface CreateImprovementActionInput {
  origin: ImprovementActionOrigin;
  sourceRef?: string;
  title: string;
  action?: string;
  responsibleName?: string;
  dueDate?: string;
}

export interface UpdateImprovementActionInput {
  title?: string;
  action?: string;
  responsibleName?: string;
  dueDate?: string;
  status?: ImprovementActionStatus;
  closedAt?: string;
  evidenceNote?: string;
}

export type ObjectiveStatus = 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED' | 'CANCELLED';

export interface SictedObjective {
  id: string;
  year: number;
  title: string;
  indicator: string | null;
  target: string | null;
  currentValue: string | null;
  status: ObjectiveStatus;
}

export interface CreateObjectiveInput {
  year: number;
  title: string;
  indicator?: string;
  target?: string;
  currentValue?: string;
}

export interface UpdateObjectiveInput {
  title?: string;
  indicator?: string;
  target?: string;
  currentValue?: string;
  status?: ObjectiveStatus;
}

/**
 * Eventos y documentos legales (SICTED fase 9, sub-PR 3).
 */

export type EventKind = 'GRUPO_MEJORA' | 'FORMACION_DESTINO' | 'EVALUACION_EXTERNA' | 'OTRO';

export interface SictedEvent {
  id: string;
  kind: EventKind;
  title: string;
  eventDate: string;
  attended: boolean;
  notes: string | null;
  attachment: { name: string } | null;
}

export interface CreateEventInput {
  kind: EventKind;
  title: string;
  eventDate: string;
  attended?: boolean;
  notes?: string;
  attachment?: File;
}

export interface SictedComplianceDoc {
  id: string;
  label: string;
  title: string;
  holderName: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  attachment: { name: string } | null;
  archivedAt: string | null;
}

export interface CreateComplianceDocInput {
  label: string;
  title: string;
  holderName?: string;
  issuedAt?: string;
  expiresAt?: string;
  attachment?: File;
}

export interface UpdateComplianceDocInput {
  label?: string;
  title?: string;
  holderName?: string;
  issuedAt?: string;
  expiresAt?: string;
  attachment?: File;
}

/**
 * Informe anual de calidad (SICTED fase 9, sub-PR 4) — agregado de solo
 * lectura de fases 2/4/6/7/8/9.
 */
export interface SictedAnnualReport {
  year: number;
  objectives: { id: string; title: string; status: string; indicator: string | null; target: string | null; currentValue: string | null }[];
  improvementActions: {
    openCount: number;
    closedThisYearCount: number;
    closedThisYear: { code: number; title: string; closedAt: string }[];
  };
  events: { kind: string; count: number }[];
  legalDocs: { label: string; title: string; expiresAt: string | null }[];
  supplierIncidents: { count: number; resolvedCount: number };
  training: { plansCount: number; actionsTotal: number; actionsDone: number };
  feedback: { total: number; open: number; overdue: number };
  satisfaction: { samplesCount: number; averageScore: number | null };
  assessment: { label: string; closedAt: string; pendingMandatoryCount: number } | null;
}
