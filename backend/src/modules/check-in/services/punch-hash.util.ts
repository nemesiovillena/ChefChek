import { createHash } from "crypto";

/** Campos que entran en la huella de un fichaje, en orden fijo. */
export interface PunchHashInput {
  id: string;
  tenantId: string;
  employeeId: string;
  type: string;
  occurredAt: Date;
  deviceTime: Date | null;
  source: string;
  recordedByUserId: string;
  locationId: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceStatus: string;
  pinStatus: string;
  wasOffline: boolean;
  seq: number;
}

/**
 * Huella encadenada: cada fichaje incluye la huella del anterior del tenant,
 * así que alterar o quitar una fila rompe la cadena a partir de ese punto.
 * El orden de los campos es parte del formato: no reordenar.
 */
export function computePunchHash(
  prevHash: string | null,
  punch: PunchHashInput,
): string {
  const canonical = [
    prevHash ?? "",
    punch.seq,
    punch.id,
    punch.tenantId,
    punch.employeeId,
    punch.type,
    punch.occurredAt.toISOString(),
    punch.deviceTime ? punch.deviceTime.toISOString() : "",
    punch.source,
    punch.recordedByUserId,
    punch.locationId ?? "",
    punch.latitude ?? "",
    punch.longitude ?? "",
    punch.geofenceStatus,
    punch.pinStatus,
    punch.wasOffline ? "1" : "0",
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
