import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  EmployeePinService,
  PIN_LOCK_MINUTES,
  PIN_MAX_FAILED_ATTEMPTS,
} from "./employee-pin.service";

function makeService(pinLength = 4) {
  const employee: any = {
    id: "emp-1",
    tenantId: "t1",
    pinHash: null,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
  };
  const prisma: any = {
    employee: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === employee.id && where.tenantId === employee.tenantId
          ? { ...employee }
          : null,
      ),
      update: jest.fn(async ({ data }: any) => Object.assign(employee, data)),
    },
  };
  const settings: any = { get: jest.fn(async () => ({ pinLength })) };
  return { service: new EmployeePinService(prisma, settings), employee };
}

describe("EmployeePinService", () => {
  it("guarda el PIN como hash, nunca en claro", async () => {
    const { service, employee } = makeService();
    await service.setPin("t1", "emp-1", "1234");
    expect(employee.pinHash).toBeTruthy();
    expect(employee.pinHash).not.toContain("1234");
  });

  it("rechaza un PIN que no tiene la longitud configurada", async () => {
    const { service } = makeService(6);
    await expect(service.setPin("t1", "emp-1", "1234")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("no opera sobre empleados de otro tenant", async () => {
    const { service } = makeService();
    await expect(service.setPin("otro", "emp-1", "1234")).rejects.toThrow(
      "Empleado no encontrado",
    );
  });

  it("verifica el PIN correcto y falla con el incorrecto", async () => {
    const { service } = makeService();
    await service.setPin("t1", "emp-1", "1234");
    expect(await service.verifyPin("t1", "emp-1", "1234")).toBe(true);
    expect(await service.verifyPin("t1", "emp-1", "0000")).toBe(false);
  });

  it("exige que el empleado tenga PIN", async () => {
    const { service } = makeService();
    await expect(service.verifyPin("t1", "emp-1", "1234")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("bloquea tras los intentos fallidos máximos, incluso con el PIN correcto", async () => {
    const { service, employee } = makeService();
    await service.setPin("t1", "emp-1", "1234");
    const now = new Date("2026-10-05T10:00:00Z");
    for (let i = 0; i < PIN_MAX_FAILED_ATTEMPTS; i++) {
      expect(await service.verifyPin("t1", "emp-1", "0000", now)).toBe(false);
    }
    expect(employee.pinLockedUntil).toEqual(
      new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000),
    );
    await expect(service.verifyPin("t1", "emp-1", "1234", now)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("vuelve a aceptar el PIN cuando vence el bloqueo", async () => {
    const { service, employee } = makeService();
    await service.setPin("t1", "emp-1", "1234");
    const now = new Date("2026-10-05T10:00:00Z");
    for (let i = 0; i < PIN_MAX_FAILED_ATTEMPTS; i++) {
      await service.verifyPin("t1", "emp-1", "0000", now);
    }
    const later = new Date(now.getTime() + (PIN_LOCK_MINUTES + 1) * 60_000);
    expect(await service.verifyPin("t1", "emp-1", "1234", later)).toBe(true);
    expect(employee.pinLockedUntil).toBeNull();
    expect(employee.pinFailedAttempts).toBe(0);
  });

  it("un acierto reinicia la cuenta de fallos", async () => {
    const { service, employee } = makeService();
    await service.setPin("t1", "emp-1", "1234");
    await service.verifyPin("t1", "emp-1", "0000");
    await service.verifyPin("t1", "emp-1", "0000");
    expect(employee.pinFailedAttempts).toBe(2);
    await service.verifyPin("t1", "emp-1", "1234");
    expect(employee.pinFailedAttempts).toBe(0);
  });
});
