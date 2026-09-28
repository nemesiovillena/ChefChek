/**
 * Compromisos por fase del ciclo de distinción SICTED — fuente: «Programa
 * SICTED», SEGITTUR, rev. 1.1 (ago-2026), §7 (modelo de distinción) y §8
 * (compromisos). Si SEGITTUR cambia plazos o mínimos, ajustar solo aquí.
 */

export const SICTED_CYCLE_PHASES = [
  "ADHESION",
  "DISTINCION",
  "SEGUIMIENTO_1",
  "SEGUIMIENTO_2",
  "RENOVACION",
] as const;
export type SictedCyclePhase = (typeof SICTED_CYCLE_PHASES)[number];

export type SictedCommitmentKey =
  | "LEGALIDAD"
  | "MANUAL_MARCA"
  | "FORMACION"
  | "ATI"
  | "ATC"
  | "AUTOEVALUACION"
  | "PLAN_MEJORA"
  | "GRUPO_MEJORA"
  | "EVALUACION_EXTERNA";

/** Cómo exige cada fase un compromiso: obligatorio, recomendable o no aplica. */
export type SictedRequirement = "REQUIRED" | "RECOMMENDED" | "NOT_APPLICABLE";

type PhaseMatrix = Record<SictedCyclePhase, SictedRequirement>;

const ALL_BUT_ADHESION: PhaseMatrix = {
  ADHESION: "NOT_APPLICABLE",
  DISTINCION: "REQUIRED",
  SEGUIMIENTO_1: "REQUIRED",
  SEGUIMIENTO_2: "REQUIRED",
  RENOVACION: "REQUIRED",
};

export const SICTED_COMMITMENT_MATRIX: Record<
  SictedCommitmentKey,
  PhaseMatrix
> = {
  LEGALIDAD: { ...ALL_BUT_ADHESION, ADHESION: "REQUIRED" },
  MANUAL_MARCA: {
    ADHESION: "NOT_APPLICABLE",
    DISTINCION: "NOT_APPLICABLE",
    SEGUIMIENTO_1: "REQUIRED",
    SEGUIMIENTO_2: "NOT_APPLICABLE",
    RENOVACION: "NOT_APPLICABLE",
  },
  FORMACION: ALL_BUT_ADHESION,
  ATI: {
    ADHESION: "NOT_APPLICABLE",
    DISTINCION: "REQUIRED",
    SEGUIMIENTO_1: "NOT_APPLICABLE",
    SEGUIMIENTO_2: "NOT_APPLICABLE",
    RENOVACION: "REQUIRED",
  },
  ATC: ALL_BUT_ADHESION,
  AUTOEVALUACION: {
    ADHESION: "NOT_APPLICABLE",
    DISTINCION: "REQUIRED",
    SEGUIMIENTO_1: "RECOMMENDED",
    SEGUIMIENTO_2: "RECOMMENDED",
    RENOVACION: "REQUIRED",
  },
  PLAN_MEJORA: ALL_BUT_ADHESION,
  GRUPO_MEJORA: {
    ADHESION: "NOT_APPLICABLE",
    DISTINCION: "NOT_APPLICABLE",
    SEGUIMIENTO_1: "REQUIRED",
    SEGUIMIENTO_2: "REQUIRED",
    RENOVACION: "REQUIRED",
  },
  EVALUACION_EXTERNA: ALL_BUT_ADHESION,
};

/** Mínimos cuantitativos del manual. */
export const SICTED_COMMITMENT_MINIMUMS = {
  /** Horas de formación en los 12 meses previos al comité (Seguimiento 1/2 y Renovación). */
  trainingHours: 4,
  /** Asesorías técnicas individualizadas: 3 en Distinción, 1 en Renovación. */
  atiByPhase: { DISTINCION: 3, RENOVACION: 1 } as Partial<
    Record<SictedCyclePhase, number>
  >,
  atc: 1,
  groupMeetings: 1,
  improvementActions: 3,
  /** La evaluación externa se hace como máximo 6 meses antes del comité. */
  externalEvaluationMonthsBeforeCommittee: 6,
};

export const SICTED_COMMITMENT_LABELS: Record<SictedCommitmentKey, string> = {
  LEGALIDAD: "Legalidad vigente",
  MANUAL_MARCA: "Manual de marca",
  FORMACION: "Formación",
  ATI: "Asesorías individuales (ATI)",
  ATC: "Asesoría colectiva (ATC)",
  AUTOEVALUACION: "Autoevaluación",
  PLAN_MEJORA: "Plan de mejora",
  GRUPO_MEJORA: "Grupo de mejora del destino",
  EVALUACION_EXTERNA: "Evaluación externa",
};
