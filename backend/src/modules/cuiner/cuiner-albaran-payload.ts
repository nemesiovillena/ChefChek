/**
 * Cálculo del albarán de compra tal como lo guarda Cuiner (DocsCab + DocsLin +
 * DocsSumas). Función pura: el conector escribe estos valores tal cual, sin
 * recalcular nada, así que cualquier diferencia de céntimos nace aquí.
 *
 * Fórmulas verificadas contra albaranes reales de Cuiner (05/10/2026):
 *  - Base   = round2(Unidades × Importe × (1 − DescuentoP/100))
 *  - CosteUM = round5(Importe × (1 − DescuentoP/100) / Medida)  (precio por unidad)
 *  - DocsSumas por tipo de IVA: Cuota = round2(Σ Base × IVA/100)
 *  - Total = Σ Base + Σ Cuota
 * ChefChek siempre envía el precio por unidad (ImporteUC = 1, UnidadesPorCaja = 1).
 */

/** TiposIVA.Codigo de Cuiner por porcentaje. El 7,5 % usa el código '7'. */
export const CUINER_VAT_CODES: Readonly<Record<string, string>> = {
  "0": "0",
  "2": "2",
  "4": "4",
  "5": "5",
  "7.5": "7",
  "10": "10",
  "21": "21",
};

/** DocsLin.Descripcion es varchar(35). */
const DESCRIPTION_MAX = 35;
/** DocsCab.Numdoc es varchar(25). */
const NUMDOC_MAX = 25;

export interface CuinerPayloadLineInput {
  articulo: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Importe neto de la línea leído del papel (sin IVA, con descuento). */
  netAmount: number | null;
  vatPercent: number;
  /** Articulos.Medida del artículo de Cuiner (p. ej. 3.6 kg por formato). */
  medida: number | null;
  lot: string | null;
}

export interface CuinerPayloadInput {
  albaranId: string;
  empresa: string;
  centro: string;
  almacen: string;
  proveedor: string;
  actUsuario: string;
  /** Fecha del albarán (solo se usa el día). */
  date: Date;
  albaranNumber: string | null;
  lines: CuinerPayloadLineInput[];
}

export interface CuinerDocLine {
  articulo: string;
  descripcion: string;
  unidades: number;
  unidadesPorCaja: 1;
  importe: number;
  descuentoP: number;
  base: number;
  costeUM: number;
  importeUC: 1;
  tipoIva: string;
  iva: number;
  lote: string;
}

export interface CuinerDocSuma {
  tipoIva: number;
  dtos: 0;
  base: number;
  cuota: number;
}

export interface CuinerAlbaranPayload {
  empresa: string;
  tipoCodigo: "P";
  codigo: string;
  centro: string;
  almacen: string;
  /** YYYY-MM-DD */
  fecha: string;
  tipoDoc: "A";
  serie: "1";
  numdoc: string | null;
  /** Marca de idempotencia: el conector no inserta si ya existe. */
  notas: string;
  actUsuario: string;
  lineas: CuinerDocLine[];
  sumas: CuinerDocSuma[];
  total: number;
}

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const cuinerIdempotencyMark = (albaranId: string): string =>
  `CHEFCHEK:${albaranId}`;

/**
 * Descuento de la línea a partir del neto del papel. Primero prueba con 2
 * decimales (lo que teclearía una persona, p. ej. 10 %) y solo si no reproduce
 * el neto del papel al céntimo usa 4 decimales (precisión de DocsLin).
 */
export function deriveDiscountPercent(
  quantity: number,
  unitPrice: number,
  netAmount: number | null,
): number {
  const gross = quantity * unitPrice;
  if (netAmount === null || gross <= 0) {
    return 0;
  }
  const net = roundTo(netAmount, 2);
  if (net >= roundTo(gross, 2)) {
    return 0;
  }

  const exact = (1 - net / gross) * 100;
  const typed = roundTo(exact, 2);
  if (roundTo(gross * (1 - typed / 100), 2) === net) {
    return typed;
  }
  return roundTo(exact, 4);
}

export function vatCodeFor(vatPercent: number): string | undefined {
  return CUINER_VAT_CODES[String(vatPercent)];
}

export function buildCuinerAlbaranPayload(
  input: CuinerPayloadInput,
): CuinerAlbaranPayload {
  const lineas: CuinerDocLine[] = input.lines.map((line) => {
    const tipoIva = vatCodeFor(line.vatPercent);
    if (tipoIva === undefined) {
      throw new Error(
        `IVA ${line.vatPercent}% no existe en Cuiner (línea "${line.description}")`,
      );
    }
    const descuentoP = deriveDiscountPercent(
      line.quantity,
      line.unitPrice,
      line.netAmount,
    );
    const netUnitPrice = line.unitPrice * (1 - descuentoP / 100);
    const medida = line.medida && line.medida > 0 ? line.medida : 1;

    return {
      articulo: line.articulo,
      descripcion: line.description.trim().slice(0, DESCRIPTION_MAX),
      unidades: line.quantity,
      unidadesPorCaja: 1,
      importe: roundTo(line.unitPrice, 4),
      descuentoP,
      base: roundTo(line.quantity * netUnitPrice, 2),
      costeUM: roundTo(netUnitPrice / medida, 5),
      importeUC: 1,
      tipoIva,
      iva: line.vatPercent,
      lote: (line.lot ?? "").trim(),
    };
  });

  const baseByVat = new Map<number, number>();
  for (const linea of lineas) {
    baseByVat.set(linea.iva, (baseByVat.get(linea.iva) ?? 0) + linea.base);
  }
  const sumas: CuinerDocSuma[] = [...baseByVat.entries()]
    .sort(([a], [b]) => a - b)
    .map(([iva, base]) => {
      const roundedBase = roundTo(base, 2);
      return {
        tipoIva: iva,
        dtos: 0,
        base: roundedBase,
        cuota: roundTo((roundedBase * iva) / 100, 2),
      };
    });

  const total = roundTo(
    sumas.reduce((acc, s) => acc + s.base + s.cuota, 0),
    2,
  );

  const numdoc = input.albaranNumber?.trim().slice(0, NUMDOC_MAX) || null;

  return {
    empresa: input.empresa,
    tipoCodigo: "P",
    codigo: input.proveedor,
    centro: input.centro,
    almacen: input.almacen,
    fecha: input.date.toISOString().slice(0, 10),
    tipoDoc: "A",
    serie: "1",
    numdoc,
    notas: cuinerIdempotencyMark(input.albaranId),
    actUsuario: input.actUsuario,
    lineas,
    sumas,
    total,
  };
}
