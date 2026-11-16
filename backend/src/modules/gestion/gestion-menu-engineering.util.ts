/**
 * Ingeniería de menú (matriz popularidad × rentabilidad, Kasavana-Smith /
 * BCG adaptada): cruza la popularidad y el margen de cada plato frente a la
 * media de los platos con los que compite (su familia).
 * - Popular: su cuota de unidades ≥ factor × la cuota media (100 / nº platos).
 *   Factor 1 = 100 % de la media (por defecto); 0,7 = regla clásica del 70 %.
 * - Rentable: su margen unitario ≥ margen medio ponderado por unidades.
 */
export type MenuClass = "estrella" | "caballo" | "puzzle" | "perro";

/** Factores de popularidad admitidos: 100 % de la media o el 70 % clásico. */
export const POPULARITY_FACTORS = [1, 0.7] as const;
export type PopularityFactor = (typeof POPULARITY_FACTORS)[number];

export const MENU_CLASS_LABEL: Record<MenuClass, string> = {
  estrella: "Estrella",
  caballo: "Percherón",
  puzzle: "Puzzle",
  perro: "Perro",
};

/** Qué hacer con cada clase, para la pantalla. */
export const MENU_CLASS_HINT: Record<MenuClass, string> = {
  estrella: "Popular y rentable: mantener, destacar y probar a subir precio.",
  caballo:
    "Se vende mucho pero deja poco: trabajar el plato (cantidad, materia prima, menaje) o subir precio.",
  puzzle:
    "Rentable pero se vende poco: plan de venta (mejor sitio en carta, sugerencia de sala, nombre).",
  perro:
    "Poco vendido y poco margen: fuera de carta, salvo que cumpla una función.",
};

/** Tolerancia para que 20,0000001 % no pase por «bajo» por redondeo. */
const EPS = 1e-9;

export interface MenuItemInput {
  key: string;
  units: number;
  /** Precio medio de venta sin IVA por unidad. */
  price: number;
  /** Coste teórico por unidad. */
  cost: number;
}

export interface MenuItemResult extends MenuItemInput {
  margin: number;
  /** % de las unidades vendidas del conjunto analizado. */
  mix: number;
  popular: boolean;
  profitable: boolean;
  menuClass: MenuClass;
}

export function classifyMenu(
  items: MenuItemInput[],
  popularityFactor: number = 1,
): {
  items: MenuItemResult[];
  popularityThreshold: number;
  averageMargin: number;
} {
  const totalUnits = items.reduce((n, i) => n + i.units, 0);
  if (items.length === 0 || totalUnits <= 0) {
    return { items: [], popularityThreshold: 0, averageMargin: 0 };
  }
  const popularityThreshold = (100 / items.length) * popularityFactor;
  const averageMargin =
    items.reduce((n, i) => n + (i.price - i.cost) * i.units, 0) / totalUnits;
  return {
    popularityThreshold,
    averageMargin,
    items: items.map((i) => {
      const margin = i.price - i.cost;
      const mix = (i.units / totalUnits) * 100;
      const popular = mix + EPS >= popularityThreshold;
      const profitable = margin + EPS >= averageMargin;
      const menuClass: MenuClass = popular
        ? profitable
          ? "estrella"
          : "caballo"
        : profitable
          ? "puzzle"
          : "perro";
      return { ...i, margin, mix, popular, profitable, menuClass };
    }),
  };
}

/**
 * Regla 80/20: ordena de más a menos y cuenta cuántos platos hacen falta para
 * llegar al 80 % de lo vendido, con la cuota y el % acumulado de cada uno.
 */
export function paretoOf<T extends { value: number }>(
  items: T[],
  target = 80,
): { items: (T & { share: number; cumulative: number })[]; needed: number } {
  const total = items.reduce((n, i) => n + Math.max(i.value, 0), 0);
  let acc = 0;
  let needed = 0;
  const sorted = [...items]
    .sort((a, b) => b.value - a.value)
    .map((i) => {
      const share = total > 0 ? (Math.max(i.value, 0) / total) * 100 : 0;
      if (acc < target - EPS) {
        needed += 1;
      }
      acc += share;
      return { ...i, share, cumulative: acc };
    });
  return { items: sorted, needed: total > 0 ? needed : 0 };
}

export interface OmnesResult {
  dishes: number;
  minPrice: number;
  maxPrice: number;
  /** Amplitud de gama: precio más alto / más bajo. */
  amplitude: number;
  /** Máximo recomendado: 2,5 hasta 9 platos; 3 con 10 o más. */
  amplitudeLimit: number;
  amplitudeOk: boolean;
  /** Tres tramos de precio de igual anchura: bajo, medio y alto. */
  bands: { from: number; to: number; count: number }[];
  /** En el tramo medio tantos platos como en el bajo y el alto juntos. */
  bandsOk: boolean;
  /** Media simple de los precios de carta (precio ofertado). */
  offeredAverage: number;
  /** Ingreso / unidades: lo que de verdad paga el cliente (precio demandado). */
  demandedAverage: number;
  /** Demandado / ofertado: entre 0,85 y 1,05 está bien. */
  ratio: number;
  ratioOk: boolean;
}

export const OMNES_RATIO_MIN = 0.85;
export const OMNES_RATIO_MAX = 1.05;

/**
 * Principios de Omnes sobre los precios de una familia: amplitud de gama,
 * dispersión en tres tramos y relación precio demandado / ofertado.
 * null si no hay al menos dos platos con precio y ventas.
 */
export function omnesOf(
  items: { price: number; units: number }[],
): OmnesResult | null {
  const list = items.filter((i) => i.price > 0 && i.units > 0);
  if (list.length < 2) {
    return null;
  }
  const prices = list.map((i) => i.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const amplitude = maxPrice / minPrice;
  const amplitudeLimit = list.length <= 9 ? 2.5 : 3;
  const width = (maxPrice - minPrice) / 3;
  const bands = [0, 1, 2].map((b) => ({
    from: minPrice + width * b,
    to: b === 2 ? maxPrice : minPrice + width * (b + 1),
    count: 0,
  }));
  for (const p of prices) {
    // Todos al mismo precio: cuentan en el tramo medio.
    const b =
      width > 0 ? Math.min(2, Math.floor((p - minPrice) / width + EPS)) : 1;
    bands[b].count += 1;
  }
  const offeredAverage = prices.reduce((n, p) => n + p, 0) / list.length;
  const units = list.reduce((n, i) => n + i.units, 0);
  const demandedAverage =
    list.reduce((n, i) => n + i.price * i.units, 0) / units;
  const ratio = demandedAverage / offeredAverage;
  return {
    dishes: list.length,
    minPrice,
    maxPrice,
    amplitude,
    amplitudeLimit,
    amplitudeOk: amplitude <= amplitudeLimit + EPS,
    bands,
    bandsOk: bands[1].count === bands[0].count + bands[2].count,
    offeredAverage,
    demandedAverage,
    ratio,
    ratioOk: ratio >= OMNES_RATIO_MIN - EPS && ratio <= OMNES_RATIO_MAX + EPS,
  };
}
