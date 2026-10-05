import { BadRequestException } from "@nestjs/common";
import { CheckInLegalTextKind } from "@prisma/client";
import { LEGAL_TEXT_DRAFTS } from "../constants/legal-text-drafts";
import { LegalTextsService } from "./legal-texts.service";

function makeService() {
  const rows: any[] = [];
  let seq = 0;
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, value]: [string, any]) =>
      value && typeof value === "object" && "not" in value
        ? row[key] !== value.not
        : row[key] === value,
    );
  const prisma: any = {
    checkInLegalText: {
      findMany: jest.fn(async ({ where, orderBy, distinct }: any) => {
        let found = rows.filter((row) => matches(row, where));
        if (orderBy?.version === "desc") {
          found = [...found].sort((a, b) => b.version - a.version);
        }
        if (distinct) {
          const seen = new Set();
          found = found.filter(
            (row) => !seen.has(row.kind) && seen.add(row.kind),
          );
        }
        return found;
      }),
      findFirst: jest.fn(
        async ({ where }: any) =>
          [...rows]
            .filter((row) => matches(row, where))
            .sort((a, b) => b.version - a.version)[0] ?? null,
      ),
      createMany: jest.fn(async ({ data }: any) => {
        for (const item of data) {
          rows.push({ id: `lt-${++seq}`, validatedAt: null, ...item });
        }
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `lt-${++seq}`, validatedAt: null, ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(
          rows.find((row) => row.id === where.id),
          data,
        ),
      ),
    },
  };
  return { service: new LegalTextsService(prisma), rows };
}

const ADMIN = { id: "u1", name: "Ana Admin" };
const KIND = CheckInLegalTextKind.GEOLOCALIZACION;
const FINAL_TEXT = "Texto revisado por la empresa, sin campos pendientes.";

async function validateAll(service: LegalTextsService, tenantId = "t1") {
  for (const draft of LEGAL_TEXT_DRAFTS) {
    await service.save(tenantId, draft.kind, FINAL_TEXT, ADMIN.id);
    await service.validate(tenantId, draft.kind, ADMIN);
  }
}

describe("LegalTextsService", () => {
  it("siembra un borrador por tipo y no los duplica", async () => {
    const { service, rows } = makeService();
    await service.list("t1");
    await service.list("t1");
    expect(rows).toHaveLength(LEGAL_TEXT_DRAFTS.length);
  });

  it("no está listo para fichar mientras falte validar algún texto", async () => {
    const { service } = makeService();
    await service.list("t1");
    const readiness = await service.getReadiness("t1");
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toHaveLength(LEGAL_TEXT_DRAFTS.length);
  });

  it("queda listo cuando todos los textos están validados", async () => {
    const { service } = makeService();
    await validateAll(service);
    expect(await service.getReadiness("t1")).toEqual({
      ready: true,
      missing: [],
    });
  });

  it("no permite validar un texto con campos entre corchetes", async () => {
    const { service } = makeService();
    await service.list("t1");
    await expect(service.validate("t1", KIND, ADMIN)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("registra quién valida y cuándo", async () => {
    const { service } = makeService();
    await service.save("t1", KIND, FINAL_TEXT, ADMIN.id);
    const validated = await service.validate("t1", KIND, ADMIN);
    expect(validated.validatedByName).toBe("Ana Admin");
    expect(validated.validatedAt).toBeInstanceOf(Date);
  });

  it("editar un borrador no crea versión nueva", async () => {
    const { service, rows } = makeService();
    await service.save("t1", KIND, FINAL_TEXT, ADMIN.id);
    await service.save("t1", KIND, `${FINAL_TEXT} Más.`, ADMIN.id);
    expect(rows.filter((row) => row.kind === KIND)).toHaveLength(1);
  });

  it("editar un texto validado abre una versión nueva y conserva la vigente", async () => {
    const { service } = makeService();
    await validateAll(service);
    await service.save(
      "t1",
      KIND,
      "Contenido cambiado tras la validación.",
      ADMIN.id,
    );

    const state = (await service.list("t1")).find((s) => s.kind === KIND)!;
    expect(state.latest.version).toBe(2);
    expect(state.latest.validatedAt).toBeNull();
    expect(state.current?.version).toBe(1);
    expect(state.current?.content).toBe(FINAL_TEXT);
    expect(state.hasPendingChanges).toBe(true);
    // La versión vigente sigue valiendo: el fichaje no se bloquea.
    expect((await service.getReadiness("t1")).ready).toBe(true);
  });

  it("guardar el mismo contenido validado no abre versión", async () => {
    const { service, rows } = makeService();
    await validateAll(service);
    await service.save("t1", KIND, FINAL_TEXT, ADMIN.id);
    expect(rows.filter((row) => row.kind === KIND)).toHaveLength(1);
  });

  it("la validación de un tenant no habilita a otro", async () => {
    const { service } = makeService();
    await validateAll(service, "t1");
    await service.list("t2");
    expect((await service.getReadiness("t2")).ready).toBe(false);
  });
});
