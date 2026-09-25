/**
 * Tipos de Personas (SICTED fase 7): fichas de puesto, plan de formación,
 * protocolos con acuse versionado. Espejo de `backend/src/modules/sicted/dto`.
 */

// --- Fichas de puesto -------------------------------------------------------

export interface JobAssignment {
  id: string;
  userId: string;
  userName: string;
  since: string;
  until: string | null;
}

export interface JobProfile {
  id: string;
  title: string;
  mission: string | null;
  responsibilities: string[];
  tasks: string[];
  requirements: string | null;
  reportsTo: string | null;
  version: number;
  archivedAt: string | null;
  assignments: JobAssignment[];
}

export interface JobProfileInput {
  title: string;
  mission?: string;
  responsibilities?: string[];
  tasks?: string[];
  requirements?: string;
  reportsTo?: string;
}

export interface UnassignedUser {
  id: string;
  name: string;
  role: string;
}

// --- Formación ---------------------------------------------------------------

export const TRAINING_TOPICS = [
  'ATENCION_CLIENTE',
  'IDIOMAS',
  'SOSTENIBILIDAD',
  'ALERGENOS',
  'HIGIENE',
  'OTRO',
] as const;
export type TrainingTopic = (typeof TRAINING_TOPICS)[number];

export const TRAINING_TOPIC_LABELS: Record<TrainingTopic, string> = {
  ATENCION_CLIENTE: 'Atención al cliente',
  IDIOMAS: 'Idiomas',
  SOSTENIBILIDAD: 'Sostenibilidad',
  ALERGENOS: 'Alérgenos',
  HIGIENE: 'Higiene',
  OTRO: 'Otro',
};

export type TrainingPlanStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export interface TrainingPlan {
  id: string;
  year: number;
  status: TrainingPlanStatus;
}

export interface TrainingAction {
  id: string;
  planId: string;
  topic: TrainingTopic;
  title: string;
  plannedDate: string;
  hours: number | null;
  trainer: string | null;
  done: boolean;
  doneAt: string | null;
  attendances: { userId: string; attended: boolean }[];
}

export interface TrainingActionInput {
  topic: TrainingTopic;
  title: string;
  plannedDate: string;
  hours?: number;
  trainer?: string;
}

export interface TrainingAttendance {
  id: string;
  actionId: string;
  userId: string;
  userName: string;
  attended: boolean;
  certificate: { storageKey: string; name: string; mime: string; size: number } | null;
  recordedAt: string;
}

export interface TrainingCoverageTopic {
  topic: TrainingTopic;
  covered: boolean;
  required: boolean;
}

export interface TrainingCoverageReport {
  year: number;
  planExists: boolean;
  topics: TrainingCoverageTopic[];
}

// --- Protocolos ----------------------------------------------------------------

export interface Protocol {
  id: string;
  area: string;
  title: string;
  version: number;
  body: string | null;
  knowledgeArticleId: string | null;
  validFrom: string;
  reviewDueAt: string | null;
  archivedAt: string | null;
}

export interface ProtocolWithContent extends Protocol {
  wikiTitle: string | null;
  wikiContent: unknown;
}

export interface ProtocolInput {
  area: string;
  title: string;
  body?: string;
  knowledgeArticleId?: string;
  reviewDueAt?: string;
}

export interface ProtocolAckMatrixRow {
  protocolId: string;
  title: string;
  area: string;
  version: number;
  employees: { userId: string; userName: string; acked: boolean }[];
}
