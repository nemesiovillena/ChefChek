/** Convierte "week"/"month" en la fecha de inicio del periodo (hoy incluido). */
export function periodStart(period: "week" | "month" | undefined): Date {
  const now = new Date();
  const start = new Date(now);
  if (period === "month") {
    start.setMonth(start.getMonth() - 1);
  } else {
    start.setDate(start.getDate() - 7);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}
