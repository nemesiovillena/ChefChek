import { PunchType } from "@prisma/client";

/** Fichaje que cuenta para la jornada: el original no anulado o uno añadido por corrección. */
export interface EffectivePunch {
  id: string;
  type: PunchType;
  occurredAt: Date;
  /** true si procede de una corrección aprobada, no de un fichaje real. */
  fromAdjustment?: boolean;
}

export interface WorkdaySegment {
  start: Date;
  end: Date;
  kind: "WORK" | "BREAK";
}

/**
 * SIN_SALIDA: hay una entrada sin su salida (olvido).
 * SECUENCIA: un fichaje que no encaja (salida sin entrada, pausa fuera de jornada…).
 */
export type WorkdayIncidence = "SIN_SALIDA" | "SECUENCIA";

export interface Workday {
  /** Día al que se imputa la jornada, en la zona horaria del centro (AAAA-MM-DD). */
  date: string;
  segments: WorkdaySegment[];
  workedMinutes: number;
  breakMinutes: number;
  incidences: WorkdayIncidence[];
  /** Jornada en curso: hay una entrada reciente sin salida todavía. */
  open: boolean;
  punchIds: string[];
}

export interface WorkdayOptions {
  timezone: string;
  /** Las pausas fichadas dentro de un tramo, ¿cuentan como tiempo de trabajo? */
  breaksCountAsWork: boolean;
  now: Date;
  /** Horas tras las que una entrada sin salida deja de ser "en curso" y pasa a incidencia. */
  openGraceHours: number;
}

/** Fecha local (AAAA-MM-DD) de un instante en una zona horaria. */
export function localDate(instant: Date, timezone: string): string {
  // en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const minutesBetween = (start: Date, end: Date) =>
  Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

/**
 * Deriva las jornadas de una persona a partir de sus fichajes efectivos.
 *
 * - Una jornada puede tener varios tramos el mismo día (turno partido): cada
 *   tramo va de una entrada a su salida y el hueco entre tramos no cuenta.
 * - Un tramo que cruza la medianoche se imputa entero al día en que empezó.
 * - Las duraciones se miden entre instantes reales, así que un cambio de hora
 *   no añade ni quita tiempo.
 * - Nunca se inventa una hora: una entrada sin salida no suma tiempo. Si es
 *   reciente la jornada está "en curso"; si no, queda como incidencia.
 *
 * Función pura: no lee la base de datos ni el reloj (recibe `now`).
 */
export function calculateWorkdays(
  punches: EffectivePunch[],
  options: WorkdayOptions,
): Workday[] {
  const ordered = [...punches].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const days = new Map<string, Workday>();
  const dayFor = (date: string): Workday => {
    let day = days.get(date);
    if (!day) {
      day = {
        date,
        segments: [],
        workedMinutes: 0,
        breakMinutes: 0,
        incidences: [],
        open: false,
        punchIds: [],
      };
      days.set(date, day);
    }
    return day;
  };
  const flag = (day: Workday, incidence: WorkdayIncidence) => {
    if (!day.incidences.includes(incidence)) {
      day.incidences.push(incidence);
    }
  };

  // Tramo abierto: día al que se imputa y desde cuándo corre el trabajo o la pausa.
  let session: { day: Workday; kind: "WORK" | "BREAK"; since: Date } | null =
    null;
  const close = (end: Date) => {
    if (!session) {
      return;
    }
    session.day.segments.push({
      start: session.since,
      end,
      kind: session.kind,
    });
  };

  for (const punch of ordered) {
    const at = punch.occurredAt;
    if (!session) {
      const day = dayFor(localDate(at, options.timezone));
      day.punchIds.push(punch.id);
      if (punch.type === PunchType.IN) {
        session = { day, kind: "WORK", since: at };
      } else {
        flag(day, "SECUENCIA");
      }
      continue;
    }

    session.day.punchIds.push(punch.id);
    if (punch.type === PunchType.IN) {
      // Entrada con otra abierta: a la anterior le falta la salida. El tramo
      // colgado no suma; empieza uno nuevo.
      flag(session.day, "SIN_SALIDA");
      session.day.punchIds.pop();
      const day = dayFor(localDate(at, options.timezone));
      day.punchIds.push(punch.id);
      session = { day, kind: "WORK", since: at };
    } else if (punch.type === PunchType.OUT) {
      // Salir estando en pausa: la pausa termina con la salida.
      if (session.kind === "BREAK") {
        flag(session.day, "SECUENCIA");
      }
      close(at);
      session = null;
    } else if (punch.type === PunchType.BREAK_START) {
      if (session.kind === "WORK") {
        close(at);
        session = { day: session.day, kind: "BREAK", since: at };
      } else {
        flag(session.day, "SECUENCIA");
      }
    } else {
      // BREAK_END
      if (session.kind === "BREAK") {
        close(at);
        session = { day: session.day, kind: "WORK", since: at };
      } else {
        flag(session.day, "SECUENCIA");
      }
    }
  }

  if (session) {
    const openMs = options.now.getTime() - session.since.getTime();
    const lastPunchAt = ordered[ordered.length - 1].occurredAt;
    const idleMs = options.now.getTime() - lastPunchAt.getTime();
    if (
      Math.max(openMs, idleMs) < options.openGraceHours * 3_600_000 &&
      idleMs >= 0
    ) {
      session.day.open = true;
    } else {
      flag(session.day, "SIN_SALIDA");
    }
  }

  for (const day of days.values()) {
    const work = day.segments
      .filter((s) => s.kind === "WORK")
      .reduce((sum, s) => sum + minutesBetween(s.start, s.end), 0);
    day.breakMinutes = day.segments
      .filter((s) => s.kind === "BREAK")
      .reduce((sum, s) => sum + minutesBetween(s.start, s.end), 0);
    day.workedMinutes =
      work + (options.breaksCountAsWork ? day.breakMinutes : 0);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
