import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../../src/common/services/prisma.service";
import { BunnyStorageService } from "../../src/common/bunny/bunny-storage.service";
import { SictedJobProfileService } from "../../src/modules/sicted/services/sicted-job-profile.service";
import { SictedTrainingService } from "../../src/modules/sicted/services/sicted-training.service";
import { SictedProtocolService } from "../../src/modules/sicted/services/sicted-protocol.service";

/**
 * Fase 7 SICTED — Personas: puestos, formación, protocolos con acuse.
 * Contra Postgres real: los triggers de inalterabilidad solo se disparan en
 * la base de datos, no en un mock.
 */
describe("E2E - Personas SICTED (fase 7)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let jobProfiles: SictedJobProfileService;
  let training: SictedTrainingService;
  let protocols: SictedProtocolService;
  let tenantId: string;
  let otherTenantId: string;
  let userA: { id: string; name: string };
  let userB: { id: string; name: string };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PrismaService,
        BunnyStorageService,
        SictedJobProfileService,
        SictedTrainingService,
        SictedProtocolService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    jobProfiles = moduleRef.get(SictedJobProfileService);
    training = moduleRef.get(SictedTrainingService);
    protocols = moduleRef.get(SictedProtocolService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Personas E2E Tenant",
        slug: "e2e-sicted-personas",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Personas E2E Tenant (otro)",
        slug: "e2e-sicted-personas-otro",
        isActive: true,
      },
    });
    otherTenantId = otherTenant.id;

    const created = await prisma.user.create({
      data: {
        email: "personas-a@e2e.test",
        passwordHash: "x",
        name: "Ana Camarera",
        tenantId,
        role: "USER",
        isActive: true,
      },
    });
    userA = { id: created.id, name: created.name };
    const createdB = await prisma.user.create({
      data: {
        email: "personas-b@e2e.test",
        passwordHash: "x",
        name: "Bea Cocinera",
        tenantId,
        role: "USER",
        isActive: true,
      },
    });
    userB = { id: createdB.id, name: createdB.name };
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.sictedProtocolAck.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await tx.sictedTrainingAttendance.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
    });
    await prisma.sictedProtocol.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.sictedTrainingAction.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.sictedTrainingPlan.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.sictedJobAssignment.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.sictedJobProfile.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  describe("Fichas de puesto y asignaciones", () => {
    it("asignar a un puesto cierra la asignación vigente anterior de la misma persona", async () => {
      const camarero = await jobProfiles.create(tenantId, {
        title: "Camarero/a",
      });
      const jefeDeSala = await jobProfiles.create(tenantId, {
        title: "Jefe/a de sala",
      });

      const first = await jobProfiles.assign(tenantId, camarero.id, {
        userId: userA.id,
      });
      expect(first.until).toBeNull();

      await jobProfiles.assign(tenantId, jefeDeSala.id, { userId: userA.id });

      const reloadedFirst = await prisma.sictedJobAssignment.findUnique({
        where: { id: first.id },
      });
      expect(reloadedFirst?.until).not.toBeNull();

      const unassigned = await jobProfiles.listUnassignedActiveUsers(tenantId);
      expect(unassigned.some((u) => u.id === userA.id)).toBe(false);
    });
  });

  describe("Formación — asistencia append-only, cobertura de temas", () => {
    it("la asistencia registrada no se puede reescribir (trigger de inalterabilidad)", async () => {
      const plan = await training.getOrCreatePlan(tenantId, { year: 2027 });
      const action = await training.createAction(tenantId, plan.id, {
        topic: "ALERGENOS",
        title: "Curso de alérgenos",
        plannedDate: new Date("2027-03-01T10:00:00Z"),
      });
      await training.recordAttendanceBatch(
        tenantId,
        action.id,
        [{ userId: userA.id, attended: true }],
        undefined,
      );

      await expect(
        prisma.sictedTrainingAttendance.update({
          where: { actionId_userId: { actionId: action.id, userId: userA.id } },
          data: { attended: false },
        }),
      ).rejects.toThrow();
    });

    it("reenviar el mismo lote de asistencia es un no-op seguro (no dispara el trigger)", async () => {
      const plan = await training.getOrCreatePlan(tenantId, { year: 2028 });
      const action = await training.createAction(tenantId, plan.id, {
        topic: "IDIOMAS",
        title: "Curso de idiomas",
        plannedDate: new Date("2028-03-01T10:00:00Z"),
      });
      await training.recordAttendanceBatch(
        tenantId,
        action.id,
        [{ userId: userA.id, attended: true }],
        undefined,
      );
      // Reenviar el mismo lote no debe lanzar (skipDuplicates, no UPDATE).
      await expect(
        training.recordAttendanceBatch(
          tenantId,
          action.id,
          [{ userId: userA.id, attended: true }],
          undefined,
        ),
      ).resolves.toBeDefined();

      const rows = await training.listAttendance(tenantId, action.id);
      expect(rows).toHaveLength(1);
    });

    it("cobertura de temas: un tema con una acción marcada como hecha cuenta como cubierto, el resto no", async () => {
      const plan = await training.getOrCreatePlan(tenantId, { year: 2029 });
      const action = await training.createAction(tenantId, plan.id, {
        topic: "SOSTENIBILIDAD",
        title: "Charla de sostenibilidad",
        plannedDate: new Date("2029-01-01T10:00:00Z"),
      });
      await training.markActionDone(tenantId, action.id);

      const report = await training.coverage(tenantId, 2029);
      const sostenibilidad = report.topics.find(
        (t) => t.topic === "SOSTENIBILIDAD",
      );
      const idiomas = report.topics.find((t) => t.topic === "IDIOMAS");
      expect(sostenibilidad?.covered).toBe(true);
      expect(idiomas?.covered).toBe(false);
    });
  });

  describe("Protocolos — acuse versionado", () => {
    it("publicar una nueva versión deja pendiente de nuevo a quien ya había acusado la anterior", async () => {
      const protocol = await protocols.create(tenantId, {
        area: "Sala",
        title: "Protocolo de bienvenida",
        body: "Saludar sonriendo",
      });
      await protocols.ack(tenantId, protocol.id, userA.id, userA.name);

      let pending = await protocols.listPendingForUser(tenantId, userA.id);
      expect(pending.some((p) => p.id === protocol.id)).toBe(false);

      await protocols.publishVersion(tenantId, protocol.id, {
        body: "Saludar sonriendo y acompañar a la mesa",
      });

      pending = await protocols.listPendingForUser(tenantId, userA.id);
      expect(pending.some((p) => p.id === protocol.id)).toBe(true);
    });

    it("un acuse duplicado de la misma versión es rechazado", async () => {
      const protocol = await protocols.create(tenantId, {
        area: "Cocina",
        title: "Protocolo de higiene",
        body: "Lavarse las manos",
      });
      await protocols.ack(tenantId, protocol.id, userB.id, userB.name);

      await expect(
        protocols.ack(tenantId, protocol.id, userB.id, userB.name),
      ).rejects.toThrow(/Ya has acusado/);
    });

    it("editar solo metadatos no incrementa la versión ni invalida acuses existentes", async () => {
      const protocol = await protocols.create(tenantId, {
        area: "Sala",
        title: "Protocolo de facturación",
        body: "Cobrar en caja",
      });
      await protocols.ack(tenantId, protocol.id, userA.id, userA.name);

      await protocols.updateMeta(tenantId, protocol.id, {
        reviewDueAt: new Date("2030-01-01T00:00:00Z"),
      });

      const pending = await protocols.listPendingForUser(tenantId, userA.id);
      expect(pending.some((p) => p.id === protocol.id)).toBe(false);
    });

    it("la matriz protocolo × empleado no expone datos de otros tenants", async () => {
      const foreignUser = await prisma.user.create({
        data: {
          email: "foreign@e2e.test",
          passwordHash: "x",
          name: "Usuario ajeno",
          tenantId: otherTenantId,
          role: "USER",
          isActive: true,
        },
      });
      await protocols.create(tenantId, {
        area: "Sala",
        title: "Protocolo aislamiento",
        body: "Texto",
      });

      const matrix = await protocols.ackMatrix(tenantId);
      const allEmployeeIds = matrix.flatMap((row) =>
        row.employees.map((e) => e.userId),
      );
      expect(allEmployeeIds).not.toContain(foreignUser.id);
      // Limpieza la hace afterAll (borra todos los users de otherTenantId).
    });
  });
});
