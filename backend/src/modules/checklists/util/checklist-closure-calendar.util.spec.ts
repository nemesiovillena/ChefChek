import { isClosedDay } from "./checklist-closure-calendar.util";

describe("isClosedDay", () => {
  // Descanso lunes y martes.
  const weekly = { closedWeekdays: [1, 2], exceptions: [] };

  it("cierra los días de descanso semanal y abre el resto", () => {
    expect(isClosedDay("2026-10-05", weekly)).toBe(true); // lunes
    expect(isClosedDay("2026-10-06", weekly)).toBe(true); // martes
    expect(isClosedDay("2026-10-07", weekly)).toBe(false); // miércoles
  });

  it("sin calendario configurado no cierra nunca", () => {
    expect(
      isClosedDay("2026-10-05", { closedWeekdays: [], exceptions: [] }),
    ).toBe(false);
  });

  it("un periodo de cierre cubre sus dos extremos", () => {
    const calendar = {
      closedWeekdays: [],
      exceptions: [
        { kind: "CLOSED", fromDay: "2026-08-10", toDay: "2026-08-20" },
      ],
    };
    expect(isClosedDay("2026-08-09", calendar)).toBe(false);
    expect(isClosedDay("2026-08-10", calendar)).toBe(true);
    expect(isClosedDay("2026-08-20", calendar)).toBe(true);
    expect(isClosedDay("2026-08-21", calendar)).toBe(false);
  });

  it("una apertura excepcional manda sobre el descanso y sobre un cierre", () => {
    const calendar = {
      closedWeekdays: [1, 2],
      exceptions: [
        { kind: "CLOSED", fromDay: "2026-10-10", toDay: "2026-10-14" },
        { kind: "OPEN", fromDay: "2026-10-12", toDay: "2026-10-12" },
      ],
    };
    expect(isClosedDay("2026-10-12", calendar)).toBe(false); // lunes festivo, se abre
    expect(isClosedDay("2026-10-13", calendar)).toBe(true);
  });
});
