/**
 * Tipos de Cliente y sostenibilidad (SICTED fase 8): quejas/sugerencias/
 * felicitaciones, satisfacción, objetos perdidos. Espejo de
 * `backend/src/modules/sicted/dto`. Sostenibilidad no tiene tipos propios —
 * usa el motor de checklist compartido (`use-sicted.ts`) con `kind: "SUSTAINABILITY"`.
 */

export const FEEDBACK_KINDS = ['QUEJA', 'SUGERENCIA', 'FELICITACION'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  QUEJA: 'Queja',
  SUGERENCIA: 'Sugerencia',
  FELICITACION: 'Felicitación',
};

export const FEEDBACK_CHANNELS = ['SALA', 'WEB', 'EMAIL', 'TELEFONO', 'OTRO'] as const;
export type FeedbackChannel = (typeof FEEDBACK_CHANNELS)[number];

export const FEEDBACK_CHANNEL_LABELS: Record<FeedbackChannel, string> = {
  SALA: 'Sala',
  WEB: 'Web',
  EMAIL: 'Email',
  TELEFONO: 'Teléfono',
  OTRO: 'Otro',
};

export type FeedbackStatus = 'OPEN' | 'RESPONDED' | 'CLOSED';

export interface Feedback {
  id: string;
  kind: FeedbackKind;
  channel: FeedbackChannel;
  receivedAt: string;
  receivedByName: string;
  summary: string;
  customerContact: string | null;
  status: FeedbackStatus;
  response: string | null;
  respondedAt: string | null;
  respondedByName: string | null;
  closedAt: string | null;
  improvementActionId: string | null;
}

export interface CreateFeedbackInput {
  kind: FeedbackKind;
  channel: FeedbackChannel;
  receivedByName: string;
  summary: string;
  customerContact?: string;
}

export interface FeedbackOverdueReport {
  slaHours: number;
  items: Feedback[];
}

export interface SatisfactionSample {
  id: string;
  sampledAt: string;
  score: number;
  channel: string;
  comment: string | null;
  recordedByName: string;
}

export interface CreateSatisfactionSampleInput {
  score: number;
  channel: string;
  comment?: string;
  recordedByName: string;
}

export interface SatisfactionMonthlySummary {
  year: number;
  month: number;
  sampleCount: number;
  averageScore: number | null;
  previousAverageScore: number | null;
  trend: 'up' | 'down' | 'flat' | null;
}

export interface LostItem {
  id: string;
  foundAt: string;
  itemName: string;
  description: string | null;
  foundLocation: string | null;
  foundByName: string;
  returnedAt: string | null;
  returnedTo: string | null;
}

export interface CreateLostItemInput {
  itemName: string;
  description?: string;
  foundLocation?: string;
  foundByName: string;
}
