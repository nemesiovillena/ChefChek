import { VacationDayType } from "@prisma/client";

/** Parámetros de convenio que se copian a CheckInSettings al elegir plantilla. */
export interface LaborAgreementParams {
  annualHours: number;
  weeklyHours: number;
  maxDailyHours: number;
  minRestBetweenShiftsHours: number;
  weeklyRestDays: number;
  nightStart: string;
  nightEnd: string;
  vacationDays: number;
  vacationDayType: VacationDayType;
  overtimeYearlyCap: number;
}

export interface LaborAgreementPreset {
  key: string;
  name: string;
  /** Aviso mostrado junto al selector. */
  note: string;
  /** true = los valores son de partida y hay que contrastarlos con el convenio real. */
  needsReview: boolean;
  params: LaborAgreementParams;
}

/**
 * Mínimos y máximos legales del Estatuto de los Trabajadores (arts. 34-38):
 * 40 h semanales de promedio anual, 9 h ordinarias diarias, 12 h entre
 * jornadas, día y medio de descanso semanal, 30 días naturales de vacaciones,
 * 80 h extraordinarias al año, trabajo nocturno de 22:00 a 06:00.
 */
const ESTATUTO_PARAMS: LaborAgreementParams = {
  annualHours: 1826,
  weeklyHours: 40,
  maxDailyHours: 9,
  minRestBetweenShiftsHours: 12,
  weeklyRestDays: 1.5,
  nightStart: "22:00",
  nightEnd: "06:00",
  vacationDays: 30,
  vacationDayType: VacationDayType.NATURAL,
  overtimeYearlyCap: 80,
};

/**
 * Plantillas de convenio. No hay motor de reglas: elegir una copia sus valores
 * a los ajustes del tenant, que quedan editables.
 *
 * Los convenios de hostelería son provinciales y sus cifras (jornada anual,
 * vacaciones, descansos) varían; mientras no se carguen las de un convenio
 * concreto, la plantilla parte de los valores del Estatuto y se marca para
 * revisión.
 */
export const LABOR_AGREEMENT_PRESETS: LaborAgreementPreset[] = [
  {
    key: "hosteleria",
    name: "Hostelería",
    note: "El convenio de hostelería es provincial. Estos valores son los del Estatuto de los Trabajadores: revíselos con su convenio y ajústelos.",
    needsReview: true,
    params: { ...ESTATUTO_PARAMS },
  },
  {
    key: "personalizado-et",
    name: "Personalizado (Estatuto de los Trabajadores)",
    note: "Valores generales del Estatuto de los Trabajadores. Ajústelos a su convenio.",
    needsReview: false,
    params: { ...ESTATUTO_PARAMS },
  },
];

export function findAgreementPreset(
  key: string,
): LaborAgreementPreset | undefined {
  return LABOR_AGREEMENT_PRESETS.find((preset) => preset.key === key);
}
