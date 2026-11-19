/**
 * Cierra la incidencia SICTED de una devolución. `resolution` solo admite
 * null → valor (trigger de inalterabilidad): si ya estaba resuelta, no se toca.
 */
export async function resolveReturnIncident(
  tx: any,
  incidentId: string | null,
  resolution: string,
): Promise<void> {
  if (!incidentId) {
    return;
  }
  await tx.sictedSupplierIncident.updateMany({
    where: { id: incidentId, resolvedAt: null },
    data: { resolution, resolvedAt: new Date() },
  });
}
