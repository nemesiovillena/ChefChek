/**
 * Fecha de baja de una ficha cuando cambia su estado activo:
 * - desactivar: la que se pida, o la que ya tenía, o hoy (hora de Madrid);
 * - reactivar: se borra (vuelve a trabajar);
 * - sin cambio de estado: la que se pida (undefined = no tocarla).
 */
export function terminationDateOnActiveChange(
  wasActive: boolean,
  isActive: boolean | undefined,
  current: Date | null,
  requested?: Date | null,
): Date | null | undefined {
  if (isActive === undefined || isActive === wasActive) {
    return requested;
  }
  if (isActive) {
    return null;
  }
  return requested ?? current ?? todayInMadrid();
}

function todayInMadrid(): Date {
  // «sv-SE» da AAAA-MM-DD; se guarda como medianoche UTC de ese día.
  const ymd = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Europe/Madrid",
  });
  return new Date(`${ymd}T00:00:00.000Z`);
}
