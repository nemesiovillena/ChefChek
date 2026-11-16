/**
 * Ingeniería de menú (método Kasavana-Smith): cruza popularidad y margen de
 * cada plato frente a la media de la carta.
 * - Popular: su cuota de unidades ≥ 70 % de la cuota media (1 / nº platos).
 * - Margen alto: su margen unitario ≥ margen medio ponderado por unidades.
 */
export type MenuClass = "estrella" | "caballo" | "puzzle" | "perro";

export const MENU_CLASS_LABEL: Record<MenuClass, string> = {
  estrella: "Estrella",
  caballo: "Caballo de batalla",
  puzzle: "Puzzle",
  perro: "Perro",
};

/** Qué hacer con cada clase, para la pantalla. */
export const MENU_CLASS_HINT: Record<MenuClass, string> = {
  estrella: "Popular y rentable: mantener y destacar.",
  caballo: "Se vende mucho pero deja poco: revisar coste o precio.",
  puzzle: "Rentable pero se vende poco: darle visibilidad.",
  perro: "Poco vendido y poco margen: replantear o quitar.",
};

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
  menuClass: MenuClass;
}

export function classifyMenu(items: MenuItemInput[]): {
  items: MenuItemResult[];
  popularityThreshold: number;
  averageMargin: number;
} {
  const totalUnits = items.reduce((n, i) => n + i.units, 0);
  if (items.length === 0 || totalUnits <= 0) {
    return { items: [], popularityThreshold: 0, averageMargin: 0 };
  }
  const popularityThreshold = (100 / items.length) * 0.7;
  const averageMargin =
    items.reduce((n, i) => n + (i.price - i.cost) * i.units, 0) / totalUnits;
  return {
    popularityThreshold,
    averageMargin,
    items: items.map((i) => {
      const margin = i.price - i.cost;
      const mix = (i.units / totalUnits) * 100;
      const popular = mix >= popularityThreshold;
      const profitable = margin >= averageMargin;
      const menuClass: MenuClass = popular
        ? profitable
          ? "estrella"
          : "caballo"
        : profitable
          ? "puzzle"
          : "perro";
      return { ...i, margin, mix, menuClass };
    }),
  };
}
