import { FoodLabelForPdf, FoodLabelPdfService } from "./food-label-pdf.service";
import {
  A4_BUILTIN_PRESETS,
  LabelSpec,
  thermalSpec,
} from "../constants/label-presets";

const a4 = (id: "a4-70x37" | "a4-63x38"): LabelSpec => {
  const { name: _n, ...spec } = A4_BUILTIN_PRESETS[id];
  return spec;
};

function makeLabel(overrides: Partial<FoodLabelForPdf> = {}): FoodLabelForPdf {
  const now = new Date("2026-08-31T10:00:00.000Z");
  return {
    id: "fl1",
    tenantId: "t1",
    labelType: "ELABORATED",
    recipeId: "r1",
    productId: null,
    itemName: "Jarrete de ternera estofado a baja temperatura",
    lotNumber: "JARR-310826-01",
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
        productName: "Jarrete de ternera",
        lotId: null,
        lotNumber: "L-4471",
        quantityUsed: 1.5,
        unit: "kg",
      },
    ],
    sourceLot: null,
    ...overrides,
  } as FoodLabelForPdf;
}

describe("FoodLabelPdfService", () => {
  const service = new FoodLabelPdfService();

  it("produces a valid PDF for a thermal label", async () => {
    const buf = await service.generate(makeLabel(), thermalSpec(57, 40), 1);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("produces one page per copy on thermal format", async () => {
    const buf = await service.generate(makeLabel(), thermalSpec(57, 32), 3);
    // pdfkit escribe "/Type /Page" (con espacio) una vez por página
    const pages = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBe(3);
  });

  it("lays 24 copies onto a single A4 page (3x8 grid)", async () => {
    const buf = await service.generate(makeLabel(), a4("a4-70x37"), 24);
    const pages = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBe(1);
  });

  it("renders a HANDLED label with supplier + manufacturer expiry", async () => {
    const buf = await service.generate(
      makeLabel({
        labelType: "HANDLED",
        recipeId: null,
        productId: "p9",
        itemName: "Lubina",
        lotNumber: "MAKRO-8842",
        manufacturerExpiryDate: new Date("2026-09-10T00:00:00.000Z"),
        ingredientLots: [],
        sourceLot: { lotNumber: "MAKRO-8842", supplier: { name: "Makro" } },
      }),
      a4("a4-63x38"),
      2,
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
