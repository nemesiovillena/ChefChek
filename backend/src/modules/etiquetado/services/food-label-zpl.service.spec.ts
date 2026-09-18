import {
  computeZplLayout,
  FoodLabelZplService,
} from "./food-label-zpl.service";
import { zplSpec } from "../constants/zpl-presets";
import type { FoodLabelForPrint } from "../types/food-label-for-print.type";

function makeLabel(
  overrides: Partial<FoodLabelForPrint> = {},
): FoodLabelForPrint {
  const now = new Date("2026-08-31T10:00:00.000Z");
  return {
    id: "fl1",
    tenantId: "t1",
    labelType: "ELABORATED",
    recipeId: "r1",
    productId: null,
    itemName: "Crema catalana",
    lotNumber: "CREM-170926-01",
    sourceLotId: null,
    productionOrderId: null,
    preparedAt: now,
    manufacturerExpiryDate: null,
    useByDate: new Date("2026-09-05T21:59:59.000Z"),
    frozenAt: null,
    frozenUseByDate: null,
    storageCondition: "REFRIGERATED",
    storageTempMin: 0,
    storageTempMax: 4,
    shelfLifeDaysApplied: 5,
    quantity: 2,
    quantityUnit: "kg",
    portions: 8,
    allergens: [1, 7],
    notes: null,
    createdByUserId: "u1",
    createdByName: "Ana López",
    reprintCount: 0,
    qrToken: "tok-abc123",
    voidedAt: null,
    voidReason: null,
    createdAt: now,
    updatedAt: now,
    ingredientLots: [
      {
        id: "il1",
        foodLabelId: "fl1",
        productId: "p1",
        productName: "Huevos",
        lotId: null,
        lotNumber: "1672086",
        quantityUsed: 1.5,
        unit: "l",
      },
    ],
    sourceLot: null,
    ...overrides,
  } as FoodLabelForPrint;
}

describe("FoodLabelZplService", () => {
  const service = new FoodLabelZplService();
  const spec60x40 = zplSpec(60, 40, 203);

  it("sizes the label from mm to dots at the profile's dpi (60x40mm @203dpi)", () => {
    const zpl = service.generate(makeLabel(), spec60x40, 1);
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("^CI28");
    expect(zpl).toContain("^PW480");
    expect(zpl).toContain("^LL320");
    expect(zpl.trim().endsWith("^XZ")).toBe(true);
  });

  it("encodes copies via ^PQ, omitting it for a single copy", () => {
    const single = service.generate(makeLabel(), spec60x40, 1);
    expect(single).not.toContain("^PQ");

    const triple = service.generate(makeLabel(), spec60x40, 3);
    expect(triple).toContain("^PQ3");
  });

  it("embeds a dynamic QR pointing at the label's own qrToken", () => {
    const zpl = service.generate(
      makeLabel({ qrToken: "tok-xyz" }),
      spec60x40,
      1,
    );
    expect(zpl).toContain("^BQN,2,");
    expect(zpl).toContain("/e/tok-xyz");
  });

  it("double-prints bold fields (lote, consumir, alérgenos) for the fake-bold trick", () => {
    const zpl = service.generate(makeLabel(), spec60x40, 1);
    const loteOccurrences = zpl.split("LOTE CREM-170926-01").length - 1;
    expect(loteOccurrences).toBe(2);
    const consumirOccurrences = zpl.split("Consumir: 05/09/26").length - 1;
    expect(consumirOccurrences).toBe(2);
  });

  it("prints non-bold fields only once", () => {
    const zpl = service.generate(makeLabel(), spec60x40, 1);
    const prepOccurrences = zpl.split("Elab.: 31/08/26, 12:00").length - 1;
    expect(prepOccurrences).toBe(1);
  });

  it("prints allergen names in text and lowercase ingredients with lot", () => {
    const zpl = service.generate(makeLabel(), spec60x40, 1);
    expect(zpl).toContain("Gluten");
    expect(zpl).toContain("Leche");
    expect(zpl).toContain("huevos");
    expect(zpl).toContain("L:1672086");
  });

  it("frozen label merges freeze date and temps into one line", () => {
    const zpl = service.generate(
      makeLabel({
        frozenAt: new Date("2026-08-31T10:00:00.000Z"),
        frozenUseByDate: new Date("2026-11-29T11:00:00.000Z"),
        useByDate: new Date("2026-11-29T11:00:00.000Z"),
        storageCondition: "FROZEN",
        storageTempMin: -18,
        storageTempMax: -12,
      }),
      spec60x40,
      1,
    );
    expect(zpl).toContain("congelado");
    expect(zpl).toContain("31/08/26");
    expect(zpl).not.toContain("CONGELADO");
  });

  it("HANDLED without a lot prints 'LOTE compra <fecha>' and the supplier", () => {
    const zpl = service.generate(
      makeLabel({
        labelType: "HANDLED",
        recipeId: null,
        productId: "p2",
        itemName: "Rodaballo de Makro",
        lotNumber: "RODA-C020926",
        sourceLotId: null,
        supplierName: "Makro",
        purchaseDate: new Date("2026-09-02T00:00:00.000Z"),
        ingredientLots: [],
        sourceLot: null,
      }),
      spec60x40,
      1,
    );
    expect(zpl).toContain("compra 02/09/26");
    expect(zpl).not.toContain("RODA-C020926");
    expect(zpl).toContain("Prov.: Makro");
  });

  it("omits ingredients on a label short enough to hide them", () => {
    const shortSpec = zplSpec(57, 32, 203);
    const zpl = service.generate(makeLabel(), shortSpec, 1);
    expect(zpl).not.toContain("Ingr.:");
  });

  it("strips ZPL control characters (^ ~) from free text", () => {
    const zpl = service.generate(
      makeLabel({ itemName: "Salsa ^rara~ especial" }),
      spec60x40,
      1,
    );
    expect(zpl).not.toContain("^rara~");
    expect(zpl).toContain("Salsa rara especial");
  });

  it("derives the QR module count from the real encoded content, not a fixed guess", () => {
    const withShortToken = service.generate(
      makeLabel({ qrToken: "a" }),
      spec60x40,
      1,
    );
    const withLongToken = service.generate(
      makeLabel({ qrToken: "a".repeat(120) }),
      spec60x40,
      1,
    );
    const magOf = (zpl: string) => zpl.match(/\^BQN,2,(\d+)/)?.[1];
    // Más contenido codificado -> versión de QR mayor -> más módulos -> a
    // igualdad de tamaño físico objetivo, menor magnificación por módulo.
    expect(Number(magOf(withLongToken))).toBeLessThan(
      Number(magOf(withShortToken)),
    );
  });

  describe("computeZplLayout (plantilla de calibración)", () => {
    it("exposes named, tunable X/Y/size per field for 60x40mm @203dpi", () => {
      const layout = computeZplLayout(spec60x40, {
        qrModules: 33,
        hasHandledExtra: false,
        hasAllergens: true,
      });
      expect(layout.widthDots).toBe(480);
      expect(layout.heightDots).toBe(320);
      expect(layout.qr.modules).toBe(33);
      // Todo campo declara su propia posición/tamaño — nada implícito.
      for (const field of [
        layout.product,
        layout.lot,
        layout.prep,
        layout.consume,
        layout.conservation,
        layout.allergens,
        layout.ingredients,
        layout.responsable,
      ]) {
        expect(field.x).toBeGreaterThanOrEqual(0);
        expect(field.y).toBeGreaterThanOrEqual(0);
        expect(field.widthDots).toBeGreaterThan(0);
        expect(field.fontHeightDots).toBeGreaterThan(0);
      }
      // El QR cabe dentro del lienzo.
      expect(
        layout.qr.x + layout.qr.magnification * layout.qr.modules,
      ).toBeLessThanOrEqual(layout.widthDots);
    });

    it("moves allergens up to fill the gap when there's no HANDLED extra line", () => {
      const withExtra = computeZplLayout(spec60x40, {
        qrModules: 33,
        hasHandledExtra: true,
        hasAllergens: true,
      });
      const withoutExtra = computeZplLayout(spec60x40, {
        qrModules: 33,
        hasHandledExtra: false,
        hasAllergens: true,
      });
      expect(withoutExtra.allergens.y).toBeLessThan(withExtra.allergens.y);
    });
  });
});
