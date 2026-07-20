import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PurchaseScheduleService } from "./purchase-schedule.service";
import { PurchaseListService } from "./purchase-list.service";
import { NotificationsService } from "../../core/notifications.service";
import { PrismaService } from "../../../common/services/prisma.service";

// Referencia fija: 2026-07-15T10:00:00Z = miércoles 12:00 en Europe/Madrid (CEST, UTC+2)
const WED_12_00_MADRID = new Date("2026-07-15T10:00:00Z");

describe("PurchaseScheduleService", () => {
  let service: PurchaseScheduleService;

  const prismaMock = {
    supplier: { findFirst: jest.fn() },
    purchaseList: { findFirst: jest.fn() },
    location: { findFirst: jest.fn() },
    purchaseSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    purchaseOrderEvent: { create: jest.fn() },
  };
  const purchaseListServiceMock = { generateOrder: jest.fn() };
  const notificationsServiceMock = { createNotification: jest.fn() };

  const tenantId = "t1";

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseScheduleService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PurchaseListService, useValue: purchaseListServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();
    service = module.get(PurchaseScheduleService);
  });

  describe("shouldRun (pura)", () => {
    const base = {
      daysOfWeek: [3],
      timeOfDay: "09:00",
      enabled: true,
      lastRunAt: null as Date | null,
    };

    it("día y hora ya pasada, sin ejecución previa → true", () => {
      expect(PurchaseScheduleService.shouldRun(base, WED_12_00_MADRID)).toBe(
        true,
      );
    });

    it("enabled=false → false aunque toque", () => {
      expect(
        PurchaseScheduleService.shouldRun(
          { ...base, enabled: false },
          WED_12_00_MADRID,
        ),
      ).toBe(false);
    });

    it("día equivocado → false", () => {
      expect(
        PurchaseScheduleService.shouldRun(
          { ...base, daysOfWeek: [1] },
          WED_12_00_MADRID,
        ),
      ).toBe(false);
    });

    it("hora todavía no alcanzada → false", () => {
      expect(
        PurchaseScheduleService.shouldRun(
          { ...base, timeOfDay: "13:00" },
          WED_12_00_MADRID,
        ),
      ).toBe(false);
    });

    it("ya generado hoy (mismo día que lastRunAt) → false", () => {
      const lastRunAt = new Date("2026-07-15T08:00:00Z"); // miércoles 10:00 Madrid, mismo día
      expect(
        PurchaseScheduleService.shouldRun(
          { ...base, lastRunAt },
          WED_12_00_MADRID,
        ),
      ).toBe(false);
    });

    it("lastRunAt de un día distinto → true (puede volver a generar)", () => {
      const lastRunAt = new Date("2026-07-14T08:00:00Z"); // martes
      expect(
        PurchaseScheduleService.shouldRun(
          { ...base, lastRunAt },
          WED_12_00_MADRID,
        ),
      ).toBe(true);
    });
  });

  describe("create", () => {
    it("404 si el proveedor no es del tenant", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.create(tenantId, "u1", {
          supplierId: "sup-1",
          listId: "list-1",
          daysOfWeek: [1],
          timeOfDay: "09:00",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("404 si la lista no es del tenant", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ id: "sup-1" });
      prismaMock.purchaseList.findFirst.mockResolvedValue(null);
      await expect(
        service.create(tenantId, "u1", {
          supplierId: "sup-1",
          listId: "list-1",
          daysOfWeek: [1],
          timeOfDay: "09:00",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("crea la programación con enabled=true por defecto", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ id: "sup-1" });
      prismaMock.purchaseList.findFirst.mockResolvedValue({ id: "list-1" });
      prismaMock.purchaseSchedule.create.mockResolvedValue({ id: "sch-1" });

      await service.create(tenantId, "u1", {
        supplierId: "sup-1",
        listId: "list-1",
        daysOfWeek: [1, 3, 5],
        timeOfDay: "09:00",
      });

      expect(prismaMock.purchaseSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enabled: true,
            daysOfWeek: [1, 3, 5],
          }),
        }),
      );
    });
  });

  describe("runTick", () => {
    it("no genera nada si ninguna programación toca ahora", async () => {
      // runTick() usa `new Date()` real internamente; fijamos el reloj a un
      // miércoles para que sea determinista frente a schedules de lunes (sin
      // esto, el test fallaba cada vez que se ejecutaba en lunes real).
      jest.useFakeTimers().setSystemTime(WED_12_00_MADRID);
      try {
        prismaMock.purchaseSchedule.findMany.mockResolvedValue([
          {
            id: "sch-1",
            enabled: true,
            daysOfWeek: [1],
            timeOfDay: "09:00",
            lastRunAt: null,
          },
        ]);
        await service.runTick();
        expect(prismaMock.purchaseSchedule.updateMany).not.toHaveBeenCalled();
        expect(purchaseListServiceMock.generateOrder).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("genera pedido BORRADOR + evento + notificación cuando toca y reclama el claim", async () => {
      const schedule = {
        id: "sch-1",
        tenantId,
        supplierId: "sup-1",
        listId: "list-1",
        locationId: null,
        daysOfWeek: [new Date().getUTCDay()], // irrelevante: mockeamos Date abajo
        timeOfDay: "00:00",
        enabled: true,
        lastRunAt: null,
      };
      prismaMock.purchaseSchedule.findMany.mockResolvedValue([schedule]);
      prismaMock.purchaseSchedule.updateMany.mockResolvedValue({ count: 1 });
      purchaseListServiceMock.generateOrder.mockResolvedValue({
        id: "order-1",
        orderNumber: "PED-1",
        supplier: { name: "Doria foods" },
      });

      jest.spyOn(PurchaseScheduleService, "shouldRun").mockReturnValue(true);

      await service.runTick();

      expect(prismaMock.purchaseSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "sch-1", lastRunAt: null } }),
      );
      expect(purchaseListServiceMock.generateOrder).toHaveBeenCalledWith(
        tenantId,
        "list-1",
        undefined,
        { locationId: undefined },
      );
      expect(prismaMock.purchaseOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: "order-1",
            type: "SCHEDULED_GENERATION",
          }),
        }),
      );
      expect(notificationsServiceMock.createNotification).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ type: "SCHEDULED_ORDER_GENERATED" }),
      );

      jest.restoreAllMocks();
    });

    it("si el claim no se reclama (otro tick ya lo hizo) no genera pedido", async () => {
      const schedule = {
        id: "sch-1",
        tenantId,
        supplierId: "sup-1",
        listId: "list-1",
        locationId: null,
        daysOfWeek: [],
        timeOfDay: "00:00",
        enabled: true,
        lastRunAt: null,
      };
      prismaMock.purchaseSchedule.findMany.mockResolvedValue([schedule]);
      prismaMock.purchaseSchedule.updateMany.mockResolvedValue({ count: 0 });
      jest.spyOn(PurchaseScheduleService, "shouldRun").mockReturnValue(true);

      await service.runTick();

      expect(purchaseListServiceMock.generateOrder).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("un fallo generando el pedido no relanza (no debe tumbar el resto del tick)", async () => {
      const schedule = {
        id: "sch-1",
        tenantId,
        supplierId: "sup-1",
        listId: "list-1",
        locationId: null,
        daysOfWeek: [],
        timeOfDay: "00:00",
        enabled: true,
        lastRunAt: null,
      };
      prismaMock.purchaseSchedule.findMany.mockResolvedValue([schedule]);
      prismaMock.purchaseSchedule.updateMany.mockResolvedValue({ count: 1 });
      purchaseListServiceMock.generateOrder.mockRejectedValue(
        new Error("boom"),
      );
      jest.spyOn(PurchaseScheduleService, "shouldRun").mockReturnValue(true);

      await expect(service.runTick()).resolves.not.toThrow();

      jest.restoreAllMocks();
    });
  });

  describe("remove", () => {
    it("404 si no existe", async () => {
      prismaMock.purchaseSchedule.findFirst.mockResolvedValue(null);
      await expect(service.remove(tenantId, "sch-x")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
