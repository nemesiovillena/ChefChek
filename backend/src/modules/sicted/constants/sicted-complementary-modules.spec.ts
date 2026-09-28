import { SICTED_COMPLEMENTARY_GROUPS } from "./sicted-complementary-modules";
import { SICTED_PRACTICE_CATALOG_2026_SEED } from "./sicted-practice-catalog-2026-seed";

describe("SICTED 2026 — módulos complementarios y seed", () => {
  const seedComplementaryModules = new Set(
    SICTED_PRACTICE_CATALOG_2026_SEED.filter(
      (p) => p.chapter === "COMPLEMENTARIO",
    ).map((p) => p.moduleCode),
  );
  const groupedModules = SICTED_COMPLEMENTARY_GROUPS.flatMap(
    (g) => g.moduleCodes,
  );

  it("cada módulo complementario del seed está en exactamente un grupo", () => {
    for (const code of seedComplementaryModules) {
      expect(groupedModules.filter((c) => c === code)).toHaveLength(1);
    }
  });

  it("ningún grupo apunta a un módulo que no sea complementario en el seed", () => {
    for (const code of groupedModules) {
      expect(seedComplementaryModules.has(code)).toBe(true);
    }
  });

  it("el seed cuadra con el Índice global de BBPP (Restaurantes)", () => {
    const oficio = SICTED_PRACTICE_CATALOG_2026_SEED.filter(
      (p) => p.chapter !== "COMPLEMENTARIO",
    );
    expect(oficio).toHaveLength(258);
    expect(oficio.filter((p) => p.isMandatory)).toHaveLength(74);
    expect(SICTED_PRACTICE_CATALOG_2026_SEED).toHaveLength(336);
    const codes = SICTED_PRACTICE_CATALOG_2026_SEED.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(
      SICTED_PRACTICE_CATALOG_2026_SEED.every((p) => !!p.description),
    ).toBe(true);
  });
});
