import { createLotTraceabilityTool } from "./lot-traceability.tool";

describe("createLotTraceabilityTool", () => {
  let lotService: { findLots: jest.Mock };
  let productsService: { searchByNameLoose: jest.Mock };
  let handler: (tenantId: string, params: Record<string, any>) => Promise<any>;

  const row = (over: Record<string, any> = {}) => ({
    productName: "CR.AÑOJO LOMO ALTO",
    lotNumber: "A1",
    supplierName: "Mar Menor",
    albaranNumber: "12345",
    albaranInternalNumber: "000123",
    albaranDate: "2026-08-24T00:00:00.000Z",
    quantity: 3,
    unit: "kg",
    expiryDate: null,
    source: "lot_record",
    ...over,
  });

  beforeEach(() => {
    lotService = { findLots: jest.fn().mockResolvedValue([]) };
    productsService = { searchByNameLoose: jest.fn().mockResolvedValue([]) };
    handler = createLotTraceabilityTool(
      lotService as any,
      productsService as any,
    ).handler;
  });

  it("no incluye tenantId en el JSON schema", () => {
    const tool = createLotTraceabilityTool(
      lotService as any,
      productsService as any,
    );
    expect(tool.name).toBe("get_lot_traceability");
    expect(tool.parameters.properties).not.toHaveProperty("tenantId");
    expect(tool.parameters.required ?? []).toHaveLength(0);
  });

  it("pide artículo o lote si no se da ninguno", async () => {
    const res = await handler("t1", {});
    expect(res.error).toMatch(/artículo o el número de lote/i);
    expect(lotService.findLots).not.toHaveBeenCalled();
  });

  it("búsqueda directa: resuelve productIds y pide límite 10 sin periodo", async () => {
    productsService.searchByNameLoose.mockResolvedValueOnce([
      { id: "p1", name: "CR.AÑOJO LOMO ALTO" },
    ]);
    lotService.findLots.mockResolvedValueOnce([row()]);

    const res = await handler("t1", { productName: "lomo alto añojo" });

    expect(productsService.searchByNameLoose).toHaveBeenCalledWith(
      "t1",
      "lomo alto añojo",
    );
    expect(lotService.findLots).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        productIds: ["p1"],
        from: undefined,
        to: undefined,
        limit: 10,
      }),
    );
    expect(res.lotes[0]).not.toHaveProperty("source");
    expect(res.lotes[0].lotNumber).toBe("A1");
  });

  it("error claro si el artículo no existe", async () => {
    productsService.searchByNameLoose.mockResolvedValueOnce([]);
    const res = await handler("t1", { productName: "xyz" });
    expect(res.error).toMatch(/no encuentro ning[uú]n art[ií]culo/i);
    expect(lotService.findLots).not.toHaveBeenCalled();
  });

  it("periodo 'semana_pasada' se traduce a un rango from/to y sin límite", async () => {
    productsService.searchByNameLoose.mockResolvedValueOnce([
      { id: "p1", name: "x" },
    ]);
    lotService.findLots.mockResolvedValueOnce([row()]);

    await handler("t1", {
      productName: "lomo",
      periodo: "semana_pasada",
    });

    const arg = lotService.findLots.mock.calls[0][0];
    expect(arg.from).toBeInstanceOf(Date);
    expect(arg.to).toBeInstanceOf(Date);
    expect(arg.from.getTime()).toBeLessThan(arg.to.getTime());
  });

  it("periodo no reconocido devuelve error", async () => {
    const res = await handler("t1", { productName: "lomo", periodo: "ayer" });
    expect(res.error).toMatch(/periodo no reconocido/i);
  });

  it("búsqueda inversa por lotNumber no resuelve artículo", async () => {
    lotService.findLots.mockResolvedValueOnce([row()]);
    await handler("t1", { lotNumber: "A1" });
    expect(productsService.searchByNameLoose).not.toHaveBeenCalled();
    expect(lotService.findLots).toHaveBeenCalledWith(
      expect.objectContaining({ lotNumber: "A1", productIds: undefined }),
    );
  });

  it("sin resultados devuelve error", async () => {
    lotService.findLots.mockResolvedValueOnce([]);
    const res = await handler("t1", { lotNumber: "ZZZ" });
    expect(res.error).toMatch(/no encuentro lotes/i);
  });

  it("añade nota cuando todos los resultados vienen del texto del albarán", async () => {
    lotService.findLots.mockResolvedValueOnce([
      row({ source: "raw_line", expiryDate: null }),
    ]);
    const res = await handler("t1", { lotNumber: "260708" });
    expect(res.nota).toMatch(/texto del albar[aá]n/i);
  });

  it("fechas explícitas inválidas devuelven error", async () => {
    const res = await handler("t1", { productName: "lomo", desde: "nope" });
    expect(res.error).toMatch(/fechas inv[aá]lidas/i);
  });

  it("desde/hasta válidos: pasa el rango (hasta = fin de día) a findLots", async () => {
    productsService.searchByNameLoose.mockResolvedValueOnce([
      { id: "p1", name: "x" },
    ]);
    lotService.findLots.mockResolvedValueOnce([row()]);

    await handler("t1", {
      productName: "lomo",
      desde: "2026-08-01",
      hasta: "2026-08-15",
    });

    const arg = lotService.findLots.mock.calls[0][0];
    expect(arg.from).toEqual(new Date("2026-08-01"));
    expect(arg.to.getTime()).toBe(
      new Date("2026-08-15").getTime() + 24 * 60 * 60 * 1000 - 1,
    );
  });

  it("propaga supplierName a findLots", async () => {
    lotService.findLots.mockResolvedValueOnce([row()]);
    await handler("t1", { lotNumber: "A1", supplierName: "Mar Menor" });
    expect(lotService.findLots).toHaveBeenCalledWith(
      expect.objectContaining({ supplierName: "Mar Menor" }),
    );
  });
});
