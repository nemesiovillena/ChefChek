import { SictedJobProfileService } from "./sicted-job-profile.service";

const PERFORMERS = [
  { id: "cook", name: "Ana (cocina)" },
  { id: "waiter", name: "Luis (sala)" },
  { id: "manager", name: "Marta (encargada, puesto sin áreas)" },
  { id: "new", name: "Pepe (sin puesto)" },
];

const PROFILE_AREAS: Record<string, string[]> = {
  cook: ["Cocina", "Almacén y cámaras"],
  waiter: [" sala ", "Baños"],
  manager: [],
};

function buildService(accountAreas: string[]) {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ role: "USER" }) },
    sictedJobAssignment: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ profile: { areas: accountAreas } }),
      findMany: jest.fn().mockResolvedValue(
        Object.entries(PROFILE_AREAS).map(([userId, areas]) => ({
          userId,
          profile: { areas },
        })),
      ),
    },
  };
  return new SictedJobProfileService(prisma as any);
}

const names = (list: { id: string }[]) => list.map((p) => p.id);

describe("SictedJobProfileService.filterPerformersForAccount", () => {
  it("cuenta compartida de sala: salen los camareros, no los cocineros", async () => {
    const service = buildService(["Sala"]);
    const result = await service.filterPerformersForAccount(
      "t1",
      { id: "sala-device", isSharedAccount: true },
      PERFORMERS,
    );
    expect(names(result)).toEqual(["waiter", "manager", "new"]);
  });

  it("cuenta compartida de cocina: salen los cocineros, no los camareros", async () => {
    const service = buildService(["cocina"]);
    const result = await service.filterPerformersForAccount(
      "t1",
      { id: "kitchen-device", isSharedAccount: true },
      PERFORMERS,
    );
    expect(names(result)).toEqual(["cook", "manager", "new"]);
  });

  it("cuenta compartida cuyo puesto no tiene áreas: no filtra", async () => {
    const service = buildService([]);
    const result = await service.filterPerformersForAccount(
      "t1",
      { id: "device", isSharedAccount: true },
      PERFORMERS,
    );
    expect(result).toEqual(PERFORMERS);
  });

  it("cuenta personal: no filtra", async () => {
    const service = buildService(["Sala"]);
    const result = await service.filterPerformersForAccount(
      "t1",
      { id: "waiter", isSharedAccount: false },
      PERFORMERS,
    );
    expect(result).toEqual(PERFORMERS);
  });
});
