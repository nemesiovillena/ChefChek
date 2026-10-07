import { GeofenceMode, PunchGeofenceStatus, PunchType } from "@prisma/client";
import {
  GeofenceCenter,
  distanceMeters,
  resolveGeofence,
} from "./geofence.util";
import { PunchHashInput, computePunchHash } from "./punch-hash.util";
import {
  allowedNextTypes,
  isAllowedTransition,
  statusAfter,
} from "./punch-state.util";

const center = (over: Partial<GeofenceCenter> = {}): GeofenceCenter => ({
  id: "a",
  name: "Restaurante",
  latitude: 38.63,
  longitude: -0.86,
  geofenceRadiusM: 150,
  geofenceMode: GeofenceMode.WARN,
  ...over,
});
// ~111 m al norte por cada 0,001° de latitud.
const at = (metersNorth: number) => ({
  latitude: 38.63 + metersNorth / 111_195,
  longitude: -0.86,
});

describe("geovalla", () => {
  it("mide distancias con precisión de metros", () => {
    expect(
      distanceMeters({ latitude: 38.63, longitude: -0.86 }, at(100)),
    ).toBeCloseTo(100, 0);
  });

  it("dentro del radio es INSIDE y fuera OUTSIDE", () => {
    expect(resolveGeofence([center()], at(100), "a").status).toBe(
      PunchGeofenceStatus.INSIDE,
    );
    const outside = resolveGeofence([center()], at(400), "a");
    expect(outside.status).toBe(PunchGeofenceStatus.OUTSIDE);
    expect(outside.distanceM).toBe(400);
    expect(outside.blocked).toBe(false);
  });

  it("solo bloquea en modo BLOCK y estando fuera", () => {
    const block = center({ geofenceMode: GeofenceMode.BLOCK });
    expect(resolveGeofence([block], at(400), "a").blocked).toBe(true);
    expect(resolveGeofence([block], at(100), "a").blocked).toBe(false);
  });

  it("sin ubicación del dispositivo nunca bloquea", () => {
    const block = center({ geofenceMode: GeofenceMode.BLOCK });
    const result = resolveGeofence([block], null, "a");
    expect(result.status).toBe(PunchGeofenceStatus.UNAVAILABLE);
    expect(result.blocked).toBe(false);
  });

  it("un centro sin coordenadas o en modo OFF no comprueba", () => {
    expect(
      resolveGeofence(
        [center({ latitude: null, longitude: null })],
        at(400),
        "a",
      ).status,
    ).toBe(PunchGeofenceStatus.OFF);
    expect(
      resolveGeofence(
        [center({ geofenceMode: GeofenceMode.OFF })],
        at(400),
        "a",
      ).status,
    ).toBe(PunchGeofenceStatus.OFF);
  });

  it("con varios centros elige el que contiene el punto", () => {
    const far = center({ id: "b", name: "Obrador", latitude: 38.7 });
    const result = resolveGeofence([far, center()], at(50), "b");
    expect(result.center?.id).toBe("a");
    expect(result.status).toBe(PunchGeofenceStatus.INSIDE);
  });

  it("fuera de todos, se queda con el más cercano", () => {
    const far = center({ id: "b", latitude: 38.7 });
    expect(resolveGeofence([far, center()], at(500), "b").center?.id).toBe("a");
  });

  it("sin centros asignados no falla", () => {
    expect(resolveGeofence([], at(10), null)).toEqual({
      center: null,
      status: PunchGeofenceStatus.OFF,
      distanceM: null,
      blocked: false,
    });
  });
});

describe("secuencia de fichajes", () => {
  it("deriva la situación del último fichaje", () => {
    expect(statusAfter(null)).toBe("OUT");
    expect(statusAfter(PunchType.IN)).toBe("IN");
    expect(statusAfter(PunchType.BREAK_START)).toBe("ON_BREAK");
    expect(statusAfter(PunchType.BREAK_END)).toBe("IN");
    expect(statusAfter(PunchType.OUT)).toBe("OUT");
  });

  it("no permite dos entradas seguidas ni salir sin entrar", () => {
    expect(isAllowedTransition("IN", PunchType.IN)).toBe(false);
    expect(isAllowedTransition("OUT", PunchType.OUT)).toBe(false);
    expect(isAllowedTransition("OUT", PunchType.BREAK_START)).toBe(false);
  });

  it("permite el turno partido: tras salir se puede volver a entrar", () => {
    expect(isAllowedTransition(statusAfter(PunchType.OUT), PunchType.IN)).toBe(
      true,
    );
  });

  it("en pausa solo se puede terminar la pausa", () => {
    expect(allowedNextTypes("ON_BREAK")).toEqual([PunchType.BREAK_END]);
  });

  it("sin pausas no se ofrece empezar una, pero sí terminar la que esté abierta", () => {
    expect(allowedNextTypes("IN", false)).toEqual([PunchType.OUT]);
    expect(allowedNextTypes("ON_BREAK", false)).toEqual([PunchType.BREAK_END]);
    expect(allowedNextTypes("OUT", false)).toEqual([PunchType.IN]);
  });
});

describe("huella encadenada", () => {
  const punch: PunchHashInput = {
    id: "p1",
    tenantId: "t1",
    employeeId: "e1",
    type: "IN",
    occurredAt: new Date("2026-10-05T08:00:00Z"),
    deviceTime: null,
    source: "PERSONAL",
    recordedByUserId: "u1",
    locationId: "a",
    latitude: 38.63,
    longitude: -0.86,
    geofenceStatus: "INSIDE",
    pinStatus: "NOT_REQUIRED",
    wasOffline: false,
    seq: 1,
  };

  it("es determinista", () => {
    expect(computePunchHash(null, punch)).toBe(computePunchHash(null, punch));
    expect(computePunchHash(null, punch)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cambia si cambia cualquier dato del fichaje", () => {
    const base = computePunchHash(null, punch);
    expect(
      computePunchHash(null, {
        ...punch,
        occurredAt: new Date("2026-10-05T08:01:00Z"),
      }),
    ).not.toBe(base);
    expect(computePunchHash(null, { ...punch, type: "OUT" })).not.toBe(base);
    expect(computePunchHash(null, { ...punch, employeeId: "e2" })).not.toBe(
      base,
    );
  });

  it("depende de la huella anterior", () => {
    expect(computePunchHash("abc", punch)).not.toBe(
      computePunchHash(null, punch),
    );
  });
});
