import {
  evaluateSictedCommitments,
  SictedCommitmentFacts,
} from "./sicted-commitments-evaluator";

const NONE: SictedCommitmentFacts = {
  trainingHours: 0,
  atiCount: 0,
  atcCount: 0,
  groupMeetings: 0,
  assessmentClosedInPhase: false,
  assessmentDraftInPhase: false,
  activeImprovementActions: 0,
  plannedImprovementActions: 0,
  doneImprovementActions: 0,
  externalEvaluationInWindow: false,
  responsibleDeclarationInPhase: false,
};

function byKey(items: ReturnType<typeof evaluateSictedCommitments>) {
  return Object.fromEntries(items.map((i) => [i.key, i]));
}

describe("evaluateSictedCommitments (manual SICTED 2026 §8)", () => {
  it("Distinción sin registros: legalidad en la web, ATI/ATC/autoevaluación/plan/evaluación pendientes; grupo de mejora no aplica", () => {
    const r = byKey(evaluateSictedCommitments("DISTINCION", NONE));
    expect(r.LEGALIDAD.status).toBe("MANUAL");
    expect(r.MANUAL_MARCA.status).toBe("NOT_APPLICABLE");
    expect(r.FORMACION.status).toBe("MANUAL"); // curso básico del Campus
    expect(r.ATI.status).toBe("PENDING");
    expect(r.ATC.status).toBe("PENDING");
    expect(r.AUTOEVALUACION.status).toBe("PENDING");
    expect(r.PLAN_MEJORA.status).toBe("PENDING");
    expect(r.GRUPO_MEJORA.status).toBe("NOT_APPLICABLE");
    expect(r.EVALUACION_EXTERNA.status).toBe("PENDING");
  });

  it("Distinción: 3 ATI y 3 acciones con responsable y plazo cumplen; 2 ATI están en curso", () => {
    const ok = byKey(
      evaluateSictedCommitments("DISTINCION", {
        ...NONE,
        atiCount: 3,
        plannedImprovementActions: 3,
      }),
    );
    expect(ok.ATI.status).toBe("DONE");
    expect(ok.PLAN_MEJORA.status).toBe("DONE");
    const partial = byKey(
      evaluateSictedCommitments("DISTINCION", { ...NONE, atiCount: 2 }),
    );
    expect(partial.ATI.status).toBe("IN_PROGRESS");
  });

  it("Seguimiento: 4 h de formación cumplen, 3 h no; ATI no aplica; autoevaluación solo recomendable", () => {
    const r = byKey(
      evaluateSictedCommitments("SEGUIMIENTO_1", {
        ...NONE,
        trainingHours: 4,
        groupMeetings: 1,
      }),
    );
    expect(r.FORMACION.status).toBe("DONE");
    expect(r.GRUPO_MEJORA.status).toBe("DONE");
    expect(r.ATI.status).toBe("NOT_APPLICABLE");
    expect(r.MANUAL_MARCA.status).toBe("MANUAL");
    expect(r.AUTOEVALUACION.requirement).toBe("RECOMMENDED");
    const short = byKey(
      evaluateSictedCommitments("SEGUIMIENTO_2", { ...NONE, trainingHours: 3 }),
    );
    expect(short.FORMACION.status).toBe("IN_PROGRESS");
    expect(short.MANUAL_MARCA.status).toBe("NOT_APPLICABLE");
  });

  it("Renovación: exige declaración responsable, 1 ATI y 3 acciones ejecutadas", () => {
    const r = byKey(
      evaluateSictedCommitments("RENOVACION", {
        ...NONE,
        responsibleDeclarationInPhase: true,
        atiCount: 1,
        doneImprovementActions: 3,
        assessmentClosedInPhase: true,
        externalEvaluationInWindow: true,
      }),
    );
    expect(r.LEGALIDAD.status).toBe("DONE");
    expect(r.ATI.status).toBe("DONE");
    expect(r.PLAN_MEJORA.status).toBe("DONE");
    expect(r.AUTOEVALUACION.status).toBe("DONE");
    expect(r.EVALUACION_EXTERNA.status).toBe("DONE");
    const pending = byKey(
      evaluateSictedCommitments("RENOVACION", {
        ...NONE,
        doneImprovementActions: 2,
      }),
    );
    expect(pending.LEGALIDAD.status).toBe("PENDING");
    expect(pending.PLAN_MEJORA.status).toBe("IN_PROGRESS");
  });

  it("Adhesión: solo legalidad; el resto no aplica", () => {
    const items = evaluateSictedCommitments("ADHESION", NONE);
    expect(
      items.filter((i) => i.status !== "NOT_APPLICABLE").map((i) => i.key),
    ).toEqual(["LEGALIDAD"]);
  });
});
