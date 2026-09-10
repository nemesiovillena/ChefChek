import { inflateSync } from "zlib";
import { FoodLabelForPdf, FoodLabelPdfService } from "./food-label-pdf.service";
import {
  A4_BUILTIN_PRESETS,
  LabelSpec,
  thermalSpec,
} from "../constants/label-presets";

/**
 * Texto legible de un PDF de pdfkit: los streams van comprimidos (Flate) y
 * el texto se escribe como cadenas hex <...> (WinAnsi) dentro de operadores
 * TJ/Tj, con cortes por palabra. Se inflan los streams y se decodifican y
 * concatenan las cadenas en orden. La imagen del QR no es deflate y su
 * contenido binario es irrelevante para las aserciones.
 */
function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  let streams = "";
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try {
      streams += inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      streams += m[1];
    }
  }
  let out = "";
  const tok = /<([0-9A-Fa-f\s]*)>|\(((?:[^()\\]|\\.)*)\)/g;
  let t: RegExpExecArray | null;
  while ((t = tok.exec(streams)) !== null) {
    if (t[1] !== undefined) {
      out += Buffer.from(t[1].replace(/\s+/g, ""), "hex").toString("latin1");
    } else if (t[2] !== undefined) {
      out += t[2].replace(/\\([()\\])/g, "$1");
    }
  }
  return out;
}

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

  it("renders the full item name wrapped, without ellipsis", async () => {
    const buf = await service.generate(makeLabel(), thermalSpec(57, 40), 1);
    const text = pdfText(buf);
    // En 57 mm el nombre no cabe en una línea: se parte, no se recorta
    expect(text).toContain("estofado");
    expect(text).toContain("temperatura");
  });

  it("prints allergen names in text, one bold Consumir, lowercase ingredients with lot", async () => {
    const buf = await service.generate(makeLabel(), thermalSpec(57, 40), 1);
    const text = pdfText(buf);
    expect(text).toContain("Gluten");
    expect(text).toContain("Leche");
    expect(text).toContain("Consumir:");
    expect(text).not.toContain("Consumo pref.");
    // Ingrediente en minúsculas (el nombre propio del producto no lo es)
    // y su nº de lote
    expect(text).toContain("jarrete");
    expect(text).toContain("L:L-4471");
  });

  it("prints every ingredient with its lot, wrapping as needed", async () => {
    const buf = await service.generate(
      makeLabel({
        ingredientLots: [
          { productName: "Sal de cocina", lotNumber: "" },
          { productName: "Pimienta negra molida bote 750 g", lotNumber: "" },
          { productName: "Almidón de maíz", lotNumber: "" },
          { productName: "Vinalopó joven blanco", lotNumber: "V-22" },
          { productName: "Tomillo", lotNumber: "" },
          { productName: "Carrillada de cerdo sin hueso", lotNumber: "262894" },
        ] as FoodLabelForPdf["ingredientLots"],
      }),
      thermalSpec(57, 40),
      1,
    );
    const text = pdfText(buf);
    for (const name of [
      "sal de cocina",
      "pimienta negra",
      "almidón de maíz",
      "vinalopó joven blanco",
      "tomillo",
      "carrillada de cerdo sin hueso",
    ]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("L:262894");
    expect(text).toContain("L:V-22");
  });

  it("frozen label merges freeze date and temps into one line", async () => {
    const buf = await service.generate(
      makeLabel({
        frozenAt: new Date("2026-08-31T10:00:00.000Z"),
        frozenUseByDate: new Date("2026-11-29T11:00:00.000Z"),
        useByDate: new Date("2026-11-29T11:00:00.000Z"),
        storageCondition: "FROZEN",
        storageTempMin: -18,
        storageTempMax: -12,
      }),
      thermalSpec(57, 40),
      1,
    );
    const text = pdfText(buf);
    expect(text).toContain("congelado");
    expect(text).toContain("31/08/26");
    // La palabra CONGELADO (línea de conservación) ya no se imprime
    expect(text).not.toContain("CONGELADO");
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
