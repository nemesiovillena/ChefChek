import { Test, TestingModule } from "@nestjs/testing";
import * as fs from "fs";
import * as path from "path";
import { BunnyStorageService } from "../../src/common/bunny/bunny-storage.service";
import { PrismaService } from "../../src/common/services/prisma.service";
import { BackupExportService } from "../../src/modules/backup/backup-export.service";
import { BackupIntrospectionService } from "../../src/modules/backup/backup-introspection.service";
import { BackupProgressRegistry } from "../../src/modules/backup/backup-progress.registry";
import { BackupRestoreService } from "../../src/modules/backup/backup-restore.service";
import { BACKUP_DIR } from "../../src/modules/backup/backup.constants";

/**
 * Copia y restauración de un tenant con datos de Check-In, Turnos y el portal
 * del empleado, contra Postgres real. Comprueba que ninguna tabla nueva se
 * queda fuera de la copia, que restaurar deja los datos como estaban y que la
 * evidencia inalterable (acuses de lectura) no se toca salvo que se pida.
 */
describe("E2E - Backup de un tenant con Check-In, Turnos y RRHH", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let exporter: BackupExportService;
  let restorer: BackupRestoreService;
  const slug = "e2e-check-in-backup";
  let tenantId: string;
  let employeeId: string;
  let shiftId: string;
  let requestId: string;
  let documentId: string;

  /** Tablas de los tres módulos que cuelgan del tenant. */
  const TABLES = [
    "employees",
    "employee_locations",
    "check_in_settings",
    "absence_types",
    "absences",
    "leave_balances",
    "holidays",
    "shift_templates",
    "shifts",
    "schedule_publications",
    "employee_requests",
    "employee_documents",
    "employee_document_acks",
  ];
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        BackupExportService,
        BackupRestoreService,
        BackupIntrospectionService,
        PrismaService,
        { provide: BackupProgressRegistry, useValue: { set: jest.fn() } },
        // Sin Bunny: la copia se escribe en disco y se borra al terminar.
        { provide: BunnyStorageService, useValue: { backupsEnabled: false } },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    exporter = moduleRef.get(BackupExportService);
    restorer = moduleRef.get(BackupRestoreService);

    tenantId = (
      await prisma.tenant.create({
        data: { name: "Backup Check-In E2E", slug, isActive: true },
      })
    ).id;
    const user = await prisma.user.create({
      data: {
        email: "bk-marta@test.com",
        passwordHash: "x",
        name: "Marta Prueba",
        tenantId,
        role: "USER",
      },
    });
    const center = await prisma.location.create({
      data: { tenantId, name: "Restaurante", isDefault: true },
    });
    employeeId = (
      await prisma.employee.create({
        data: {
          tenantId,
          userId: user.id,
          firstName: "Marta",
          lastName: "Prueba",
          defaultLocationId: center.id,
          locations: { create: [{ tenantId, locationId: center.id }] },
        },
      })
    ).id;
    await prisma.checkInSettings.create({
      data: { tenantId, scheduleToleranceMinutes: 15 },
    });
    const type = await prisma.absenceType.create({
      data: { tenantId, name: "Vacaciones", deductsVacation: true },
    });
    await prisma.absence.create({
      data: {
        tenantId,
        employeeId,
        absenceTypeId: type.id,
        startDate: day("2026-08-03"),
        endDate: day("2026-08-09"),
        status: "APPROVED",
        requestedByUserId: user.id,
        requestedByName: user.name,
      },
    });
    await prisma.leaveBalance.create({
      data: { tenantId, employeeId, year: 2026, entitledDays: 30 },
    });
    await prisma.holiday.create({
      data: { tenantId, date: day("2026-12-25"), name: "Navidad" },
    });
    await prisma.shiftTemplate.create({
      data: { tenantId, name: "Mañana", startTime: "09:00", endTime: "17:00" },
    });
    shiftId = (
      await prisma.shift.create({
        data: {
          tenantId,
          locationId: center.id,
          employeeId,
          date: day("2026-11-02"),
          startTime: "09:00",
          endTime: "17:00",
          status: "PUBLISHED",
        },
      })
    ).id;
    await prisma.schedulePublication.create({
      data: {
        tenantId,
        locationId: center.id,
        weekStart: day("2026-11-02"),
        publishedShifts: 1,
        publishedByUserId: user.id,
        publishedByName: user.name,
      },
    });
    requestId = (
      await prisma.employeeRequest.create({
        data: {
          tenantId,
          employeeId,
          employeeName: "Marta Prueba",
          kind: "DATA_CHANGE",
          payload: { phone: "600 111 222" },
        },
      })
    ).id;
    documentId = (
      await prisma.employeeDocument.create({
        data: {
          tenantId,
          employeeId,
          category: "CONTRATO",
          title: "Contrato 2026",
          fileKey: `rrhh-documentos/${tenantId}/contrato.pdf`,
          fileName: "contrato.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10,
          uploadedByUserId: user.id,
          uploadedByName: user.name,
          requiresAck: true,
          expiresAt: day("2027-01-31"),
        },
      })
    ).id;
    await prisma.employeeDocumentAck.create({
      data: {
        tenantId,
        documentId,
        employeeId,
        employeeName: "Marta Prueba",
        documentTitle: "Contrato 2026",
      },
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.employeeDocumentAck.deleteMany({ where: { tenantId } });
    });
    for (const model of [
      "employeeDocument",
      "employeeRequest",
      "schedulePublication",
      "shift",
      "shiftTemplate",
      "holiday",
      "leaveBalance",
      "absence",
      "absenceType",
      "checkInSettings",
      "employee",
      "user",
    ] as const) {
      await (prisma[model] as any).deleteMany({ where: { tenantId } });
    }
    await prisma.$executeRaw`DELETE FROM "locations" WHERE "tenantId" = ${tenantId}`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ${tenantId}`;
    fs.rmSync(path.join(process.cwd(), BACKUP_DIR, tenantId), {
      recursive: true,
      force: true,
    });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  const count = async (table: string) =>
    Number(
      (
        await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "${table}" WHERE "tenantId" = $1`,
          tenantId,
        )
      )[0].n,
    );

  it("la copia del tenant incluye todas las tablas de los tres módulos", async () => {
    const { payload, coverageGap } = await exporter.run(
      "e2e-export",
      "TENANT",
      tenantId,
      slug,
    );
    for (const table of TABLES) {
      expect(coverageGap).not.toContain(table);
      expect(payload.data[table]?.length).toBeGreaterThan(0);
    }
    // Solo viaja lo de este tenant.
    for (const table of TABLES) {
      for (const row of payload.data[table] as { tenantId: string }[]) {
        expect(row.tenantId).toBe(tenantId);
      }
    }
  });

  it("restaurar deja los datos como en la copia y no toca los acuses", async () => {
    const { payload } = await exporter.run(
      "e2e-export-2",
      "TENANT",
      tenantId,
      slug,
    );
    const ackBefore = await prisma.employeeDocumentAck.findUniqueOrThrow({
      where: { documentId },
    });

    // Cambios posteriores a la copia.
    await prisma.shift.delete({ where: { id: shiftId } });
    await prisma.employeeRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", decisionNote: "No" },
    });
    await prisma.employeeDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
    await prisma.holiday.create({
      data: { tenantId, date: day("2026-12-26"), name: "Posterior" },
    });
    await prisma.checkInSettings.update({
      where: { tenantId },
      data: { scheduleToleranceMinutes: 99 },
    });

    await restorer.run("e2e-restore", payload, "TENANT", tenantId);

    expect(
      await prisma.shift.findUnique({ where: { id: shiftId } }),
    ).toMatchObject({ startTime: "09:00", status: "PUBLISHED" });
    expect(
      await prisma.employeeRequest.findUniqueOrThrow({
        where: { id: requestId },
      }),
    ).toMatchObject({
      status: "PENDING",
      decisionNote: null,
      payload: { phone: "600 111 222" },
    });
    const document = await prisma.employeeDocument.findUniqueOrThrow({
      where: { id: documentId },
    });
    expect(document.deletedAt).toBeNull();
    expect(document.expiresAt?.toISOString().slice(0, 10)).toBe("2027-01-31");
    expect(await count("holidays")).toBe(1);
    expect(
      (await prisma.checkInSettings.findUniqueOrThrow({ where: { tenantId } }))
        .scheduleToleranceMinutes,
    ).toBe(15);
    for (const table of TABLES) {
      expect(await count(table)).toBe(payload.data[table].length);
    }
    // La evidencia sigue siendo la misma fila, sin reescribir.
    const ackAfter = await prisma.employeeDocumentAck.findUniqueOrThrow({
      where: { documentId },
    });
    expect(ackAfter).toEqual(ackBefore);
  });

  it("los acuses solo se restauran si se pide expresamente", async () => {
    const { payload } = await exporter.run(
      "e2e-export-3",
      "TENANT",
      tenantId,
      slug,
    );
    await restorer.run("e2e-restore-ev", payload, "TENANT", tenantId, true);
    expect(await count("employee_document_acks")).toBe(1);
    const ack = await prisma.employeeDocumentAck.findUniqueOrThrow({
      where: { documentId },
    });
    expect(ack.documentTitle).toBe("Contrato 2026");
  });
});
