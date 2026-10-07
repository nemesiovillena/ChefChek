import {
  buildCuinerAlbaranPayload,
  deriveDiscountPercent,
  CuinerPayloadInput,
  CuinerPayloadLineInput,
} from "./cuiner-albaran-payload";

const baseInput = (lines: CuinerPayloadLineInput[]): CuinerPayloadInput => ({
  albaranId: "alb_1",
  empresa: "01",
  centro: "02",
  almacen: "01",
  proveedor: "00009",
  actUsuario: "3",
  date: new Date("2026-10-05T00:00:00.000Z"),
  albaranNumber: "PRUEBA-CHEFCHEK",
  lines,
});

const line = (
  over: Partial<CuinerPayloadLineInput>,
): CuinerPayloadLineInput => ({
  articulo: "00000000",
  description: "ARTICULO",
  quantity: 1,
  unitPrice: 1,
  netAmount: null,
  vatPercent: 10,
  medida: 1,
  lot: null,
  ...over,
});

describe("buildCuinerAlbaranPayload", () => {
  it("reproduce el albarán de prueba creado a mano en Cuiner (Id_DocsCab 21307)", () => {
    const payload = buildCuinerAlbaranPayload(
      baseInput([
        line({
          articulo: "05080005",
          description: "MAYONESA INMACULADA 3,6KG",
          quantity: 1,
          unitPrice: 8.422,
          netAmount: 7.58,
          medida: 3.6,
        }),
      ]),
    );

    expect(payload.lineas[0]).toMatchObject({
      importe: 8.422,
      descuentoP: 10,
      base: 7.58,
      costeUM: 2.1055,
      tipoIva: "10",
      iva: 10,
      unidadesPorCaja: 1,
      importeUC: 1,
    });
    expect(payload.sumas).toEqual([
      { tipoIva: 10, dtos: 0, base: 7.58, cuota: 0.76 },
    ]);
    expect(payload.total).toBe(8.34);
    expect(payload).toMatchObject({
      tipoCodigo: "P",
      codigo: "00009",
      centro: "02",
      tipoDoc: "A",
      serie: "1",
      fecha: "2026-10-05",
      numdoc: "PRUEBA-CHEFCHEK",
      notas: "CHEFCHEK:alb_1",
    });
  });

  it("reproduce las líneas con precio por unidad del albarán real 21294", () => {
    const payload = buildCuinerAlbaranPayload(
      baseInput([
        line({
          articulo: "10070007",
          quantity: 2,
          unitPrice: 50.5,
          netAmount: 88.88,
          medida: 5.5,
        }),
        line({
          articulo: "10070003",
          quantity: 2,
          unitPrice: 45.96,
          netAmount: 80.89,
          medida: 5.5,
        }),
        line({
          articulo: "10030032",
          quantity: 10,
          unitPrice: 14,
          netAmount: 140,
          medida: 1,
        }),
        line({
          articulo: "06020043",
          quantity: 1,
          unitPrice: 1.4,
          netAmount: 1.4,
          medida: 1,
        }),
      ]),
    );

    expect(
      payload.lineas.map((l) => [l.descuentoP, l.base, l.costeUM]),
    ).toEqual([
      [12, 88.88, 8.08],
      [12, 80.89, 7.3536],
      [0, 140, 14],
      [0, 1.4, 1.4],
    ]);
  });

  it("agrupa DocsSumas por tipo de IVA y cuadra el total del albarán 21294", () => {
    // Las 5 líneas reales; la de nata (precio por caja en Cuiner) se expresa
    // por unidad como la enviaría ChefChek: base idéntica 40.44.
    const payload = buildCuinerAlbaranPayload(
      baseInput([
        line({ quantity: 2, unitPrice: 50.5, netAmount: 88.88, medida: 5.5 }),
        line({ quantity: 1, unitPrice: 45.96, netAmount: 40.44, medida: 1 }),
        line({ quantity: 2, unitPrice: 45.96, netAmount: 80.89, medida: 5.5 }),
        line({ quantity: 10, unitPrice: 14, netAmount: 140, medida: 1 }),
        line({ quantity: 1, unitPrice: 1.4, netAmount: 1.4, medida: 1 }),
      ]),
    );

    expect(payload.sumas).toEqual([
      { tipoIva: 10, dtos: 0, base: 351.61, cuota: 35.16 },
    ]);
    expect(payload.total).toBe(386.77);
  });

  it("separa varias tasas de IVA en filas distintas ordenadas", () => {
    const payload = buildCuinerAlbaranPayload(
      baseInput([
        line({ quantity: 1, unitPrice: 10, vatPercent: 21 }),
        line({ quantity: 1, unitPrice: 10, vatPercent: 4 }),
        line({ quantity: 2, unitPrice: 5, vatPercent: 21 }),
      ]),
    );

    expect(payload.sumas).toEqual([
      { tipoIva: 4, dtos: 0, base: 10, cuota: 0.4 },
      { tipoIva: 21, dtos: 0, base: 20, cuota: 4.2 },
    ]);
    expect(payload.total).toBe(34.6);
    expect(payload.lineas.map((l) => l.tipoIva)).toEqual(["21", "4", "21"]);
  });

  it("usa el código '7' para el IVA del 7,5 %", () => {
    const payload = buildCuinerAlbaranPayload(
      baseInput([line({ vatPercent: 7.5 })]),
    );
    expect(payload.lineas[0].tipoIva).toBe("7");
  });

  it("rechaza un IVA que no existe en Cuiner", () => {
    expect(() =>
      buildCuinerAlbaranPayload(baseInput([line({ vatPercent: 8 })])),
    ).toThrow(/IVA 8%/);
  });

  it("recorta descripción (35) y número de albarán (25) a los tamaños de Cuiner", () => {
    const payload = buildCuinerAlbaranPayload({
      ...baseInput([line({ description: "X".repeat(50), lot: " L123 " })]),
      albaranNumber: "N".repeat(40),
    });
    expect(payload.lineas[0].descripcion).toHaveLength(35);
    expect(payload.lineas[0].lote).toBe("L123");
    expect(payload.numdoc).toHaveLength(25);
  });

  it("trata medida ausente o cero como 1 al calcular CosteUM", () => {
    const payload = buildCuinerAlbaranPayload(
      baseInput([
        line({ unitPrice: 3, medida: null }),
        line({ unitPrice: 3, medida: 0 }),
      ]),
    );
    expect(payload.lineas.map((l) => l.costeUM)).toEqual([3, 3]);
  });
});

describe("deriveDiscountPercent", () => {
  it("devuelve 0 sin neto, con neto igual o mayor al bruto", () => {
    expect(deriveDiscountPercent(1, 10, null)).toBe(0);
    expect(deriveDiscountPercent(1, 10, 10)).toBe(0);
    expect(deriveDiscountPercent(1, 10, 12)).toBe(0);
  });

  it("prefiere el porcentaje con 2 decimales que reproduce el neto del papel", () => {
    expect(deriveDiscountPercent(1, 8.422, 7.58)).toBe(10);
  });

  it("cae a 4 decimales cuando ningún porcentaje redondo cuadra el neto", () => {
    // Con importes > 100 € un paso de 0,01 % mueve más de un céntimo.
    const pct = deriveDiscountPercent(1, 1000, 876.54);
    expect(pct).toBe(12.346);
    expect(Math.round(1000 * (1 - pct / 100) * 100) / 100).toBe(876.54);
  });
});
