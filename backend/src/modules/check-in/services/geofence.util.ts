import { GeofenceMode, PunchGeofenceStatus } from "@prisma/client";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceCenter {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  geofenceMode: GeofenceMode;
}

export interface GeofenceResult {
  center: GeofenceCenter | null;
  status: PunchGeofenceStatus;
  distanceM: number | null;
  /** true si el centro está en modo BLOCK y el fichaje cae fuera de zona. */
  blocked: boolean;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const checksLocation = (center: GeofenceCenter) =>
  center.geofenceMode !== GeofenceMode.OFF &&
  center.latitude !== null &&
  center.longitude !== null;

/**
 * Resuelve a qué centro corresponde un fichaje y si cae dentro de su zona.
 *
 * - Entre los centros candidatos gana el que contiene el punto; si ninguno,
 *   el más cercano. Sin coordenadas del dispositivo se usa `fallbackId`.
 * - Un centro sin coordenadas o en modo OFF no comprueba nada (OFF).
 * - Sin ubicación del dispositivo el resultado es UNAVAILABLE y nunca bloquea:
 *   un GPS que falla no puede impedir cumplir la obligación de registrar.
 */
export function resolveGeofence(
  centers: GeofenceCenter[],
  point: GeoPoint | null,
  fallbackId: string | null,
): GeofenceResult {
  const fallback =
    centers.find((c) => c.id === fallbackId) ?? centers[0] ?? null;
  if (!fallback) {
    return {
      center: null,
      status: PunchGeofenceStatus.OFF,
      distanceM: null,
      blocked: false,
    };
  }

  const checked = centers.filter(checksLocation);
  if (!point) {
    return {
      center: fallback,
      status: checksLocation(fallback)
        ? PunchGeofenceStatus.UNAVAILABLE
        : PunchGeofenceStatus.OFF,
      distanceM: null,
      blocked: false,
    };
  }
  if (checked.length === 0) {
    return {
      center: fallback,
      status: PunchGeofenceStatus.OFF,
      distanceM: null,
      blocked: false,
    };
  }

  const measured = checked
    .map((center) => ({
      center,
      distanceM: distanceMeters(point, {
        latitude: center.latitude as number,
        longitude: center.longitude as number,
      }),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
  const inside = measured.find((m) => m.distanceM <= m.center.geofenceRadiusM);
  const chosen = inside ?? measured[0];
  const status = inside
    ? PunchGeofenceStatus.INSIDE
    : PunchGeofenceStatus.OUTSIDE;

  return {
    center: chosen.center,
    status,
    distanceM: Math.round(chosen.distanceM),
    blocked:
      status === PunchGeofenceStatus.OUTSIDE &&
      chosen.center.geofenceMode === GeofenceMode.BLOCK,
  };
}
