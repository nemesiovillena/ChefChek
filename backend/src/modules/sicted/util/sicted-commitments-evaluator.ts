import {
  SICTED_COMMITMENT_LABELS,
  SICTED_COMMITMENT_MATRIX,
  SICTED_COMMITMENT_MINIMUMS as MIN,
  SictedCommitmentKey,
  SictedCyclePhase,
  SictedRequirement,
} from "../constants/sicted-cycle-commitments";

/**
 * - DONE: cumplido con lo registrado en Chefchek.
 * - IN_PROGRESS: hay registros pero no llegan al mínimo.
 * - PENDING: sin registros.
 * - MANUAL: solo se puede cumplir/verificar en la web oficial SICTED.
 * - NOT_APPLICABLE: la fase no lo exige.
 */
export type SictedCommitmentStatus =
  | "DONE"
  | "IN_PROGRESS"
  | "PENDING"
  | "MANUAL"
  | "NOT_APPLICABLE";

/** Hechos ya filtrados a las ventanas de tiempo que marca el manual. */
export interface SictedCommitmentFacts {
  trainingHours: number; // acciones formativas hechas en los 12 meses previos al comité
  atiCount: number; // en la fase
  atcCount: number; // en la fase
  groupMeetings: number; // grupos de mejora a los que se asistió en la fase
  assessmentClosedInPhase: boolean;
  assessmentDraftInPhase: boolean;
  activeImprovementActions: number; // no canceladas
  plannedImprovementActions: number; // no canceladas, con responsable y plazo
  doneImprovementActions: number;
  externalEvaluationInWindow: boolean; // en los 6 meses previos al comité
  responsibleDeclarationInPhase: boolean; // documento legal «declaración responsable»
}

export interface SictedCommitmentItem {
  key: SictedCommitmentKey;
  label: string;
  requirement: SictedRequirement;
  status: SictedCommitmentStatus;
  detail: string;
}

function countStatus(count: number, min: number): SictedCommitmentStatus {
  if (count >= min) {
    return "DONE";
  }
  return count > 0 ? "IN_PROGRESS" : "PENDING";
}

function evaluateOne(
  key: SictedCommitmentKey,
  phase: SictedCyclePhase,
  f: SictedCommitmentFacts,
): { status: SictedCommitmentStatus; detail: string } {
  switch (key) {
    case "LEGALIDAD":
      if (phase === "RENOVACION") {
        return f.responsibleDeclarationInPhase
          ? {
              status: "DONE",
              detail: "Declaración responsable registrada en Legal.",
            }
          : {
              status: "PENDING",
              detail:
                "Firma la declaración responsable (web SICTED) y súbela en Dirección → Legal.",
            };
      }
      return phase === "ADHESION" || phase === "DISTINCION"
        ? {
            status: "MANUAL",
            detail: "Protocolo de adhesión firmado en la web SICTED.",
          }
        : {
            status: "MANUAL",
            detail:
              "Acepta la casilla en el Espacio de implantación de la web SICTED.",
          };
    case "MANUAL_MARCA":
      return {
        status: "MANUAL",
        detail: "Acepta el Manual de uso de marca en la web SICTED.",
      };
    case "FORMACION":
      if (phase === "DISTINCION") {
        return {
          status: "MANUAL",
          detail: `Curso básico «Cómo implantar el modelo SICTED» en el Campus. Registradas: ${f.trainingHours} h.`,
        };
      }
      return {
        status: countStatus(f.trainingHours, MIN.trainingHours),
        detail: `${f.trainingHours} h de ${MIN.trainingHours} h en los 12 meses previos al comité.`,
      };
    case "ATI": {
      const min = MIN.atiByPhase[phase] ?? 0;
      return {
        status: countStatus(f.atiCount, min),
        detail: `${f.atiCount} de ${min} en la fase.`,
      };
    }
    case "ATC":
      return {
        status: countStatus(f.atcCount, MIN.atc),
        detail: `${f.atcCount} de ${MIN.atc} en la fase.`,
      };
    case "AUTOEVALUACION":
      if (f.assessmentClosedInPhase) {
        return { status: "DONE", detail: "Autoevaluación cerrada en la fase." };
      }
      return f.assessmentDraftInPhase
        ? {
            status: "IN_PROGRESS",
            detail: "Hay una autoevaluación en borrador: ciérrala al terminar.",
          }
        : { status: "PENDING", detail: "Sin autoevaluación en esta fase." };
    case "PLAN_MEJORA":
      if (phase === "RENOVACION") {
        return {
          status: countStatus(f.doneImprovementActions, MIN.improvementActions),
          detail: `${f.doneImprovementActions} de ${MIN.improvementActions} acciones ejecutadas.`,
        };
      }
      if (phase === "DISTINCION") {
        return {
          status: countStatus(
            f.plannedImprovementActions,
            MIN.improvementActions,
          ),
          detail: `${f.plannedImprovementActions} de ${MIN.improvementActions} acciones con responsable y plazo.`,
        };
      }
      return {
        status: countStatus(f.activeImprovementActions, MIN.improvementActions),
        detail: `${f.activeImprovementActions} acciones en seguimiento (${f.doneImprovementActions} ejecutadas).`,
      };
    case "GRUPO_MEJORA":
      return {
        status: countStatus(f.groupMeetings, MIN.groupMeetings),
        detail: `${f.groupMeetings} reunión(es) en la fase.`,
      };
    case "EVALUACION_EXTERNA":
      return f.externalEvaluationInWindow
        ? {
            status: "DONE",
            detail:
              "Evaluación externa registrada en los 6 meses previos al comité.",
          }
        : {
            status: "PENDING",
            detail: `Máximo ${MIN.externalEvaluationMonthsBeforeCommittee} meses antes del comité; conviene que sea lo último.`,
          };
  }
}

/** Estado de cada compromiso de la fase. Función pura: toda la lectura de BD está en el servicio. */
export function evaluateSictedCommitments(
  phase: SictedCyclePhase,
  facts: SictedCommitmentFacts,
): SictedCommitmentItem[] {
  return (Object.keys(SICTED_COMMITMENT_MATRIX) as SictedCommitmentKey[]).map(
    (key) => {
      const requirement = SICTED_COMMITMENT_MATRIX[key][phase];
      const base = { key, label: SICTED_COMMITMENT_LABELS[key], requirement };
      if (requirement === "NOT_APPLICABLE") {
        return {
          ...base,
          status: "NOT_APPLICABLE" as const,
          detail: "No se exige en esta fase.",
        };
      }
      return { ...base, ...evaluateOne(key, phase, facts) };
    },
  );
}
