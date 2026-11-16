import { keepPreviousData, useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { type DateRange, GESTION_BASE, type MenuClass } from './gestion-api';

export type MenuScope = 'comida' | 'bebida';
export type PopularityFactor = 1 | 0.7;

export const MENU_CLASSES: MenuClass[] = ['estrella', 'caballo', 'puzzle', 'perro'];

export const MENU_CLASS_INFO: Record<MenuClass, { label: string; plural: string; icon: string; rule: string; action: string; color: string }> = {
  estrella: {
    label: 'Estrella',
    plural: 'Estrellas',
    icon: 'star',
    rule: 'Muy popular · muy rentable',
    action: 'Elasticidad en el precio: mantener la calidad, destacarlo en carta y probar a subir el precio poco a poco.',
    color: 'var(--me-estrella)',
  },
  caballo: {
    label: 'Percherón',
    plural: 'Percherones',
    icon: 'agriculture',
    rule: 'Muy popular · poco rentable',
    action: 'Hay que trabajar el plato: reducir cantidad, cambiar materia prima o menaje, o subir algo el precio.',
    color: 'var(--me-caballo)',
  },
  puzzle: {
    label: 'Puzzle',
    plural: 'Puzzles',
    icon: 'extension',
    rule: 'Poco popular · muy rentable',
    action: 'Plan específico de venta: mejor sitio en la carta, nombre y descripción, sugerencia de sala.',
    color: 'var(--me-puzzle)',
  },
  perro: {
    label: 'Perro',
    plural: 'Perros',
    icon: 'pets',
    rule: 'Poco popular · poco rentable',
    action: 'Fuera de carta, salvo que cumpla una función (clientes fieles, dietas) y se pueda reformular.',
    color: 'var(--me-perro)',
  },
};

export interface MenuEngineeringRow {
  key: string;
  name: string;
  cost: number;
  price: number;
  margin: number;
  costPct: number | null;
  units: number;
  totalCost: number;
  revenue: number;
  totalMargin: number;
  popularity: number;
  popular: boolean;
  profitable: boolean;
  menuClass: MenuClass;
  recipeId: string | null;
  previousClass: MenuClass | null;
}

export interface ParetoItem {
  key: string;
  name: string;
  group: string;
  value: number;
  share: number;
  cumulative: number;
}

export interface OmnesResult {
  dishes: number;
  minPrice: number;
  maxPrice: number;
  amplitude: number;
  amplitudeLimit: number;
  amplitudeOk: boolean;
  bands: { from: number; to: number; count: number }[];
  bandsOk: boolean;
  offeredAverage: number;
  demandedAverage: number;
  ratio: number;
  ratioOk: boolean;
}

export interface GrayZone {
  salesBase: number;
  menuAverageCostPct: number | null;
  theoreticalCostPct: number | null;
  theoreticalCost: number;
  coverage: number | null;
  realCost: number;
  realCostPct: number | null;
  gapPoints: number | null;
  gapEuros: number | null;
  controls: {
    invitations: { units: number; cost: number; value: number };
    cancellations: { tickets: number; lines: number; total: number };
  };
}

export interface MenuEngineeringAnalysis {
  range: DateRange;
  previousRange: DateRange;
  scope: MenuScope;
  popularityFactor: PopularityFactor;
  groups: { name: string; dishes: number; costed: number; revenue: number }[];
  group: string | null;
  matrix: {
    rows: MenuEngineeringRow[];
    withoutCost: { key: string; name: string; units: number; recipeId: string | null }[];
    thresholds: { popularity: number; margin: number };
    totals: { units: number; totalCost: number; revenue: number; totalMargin: number; costPct: number | null };
    simpleMeans: { cost: number; price: number; margin: number };
    weightedMeans: { cost: number; price: number; margin: number };
  };
  pareto: {
    dishes: number;
    byRevenue: { needed: number; items: ParetoItem[] };
    byUnits: { needed: number; items: ParetoItem[] };
  };
  omnes: OmnesResult | null;
  grayZone: GrayZone;
  costRatios: {
    salesBase: number;
    rawMaterial: { cost: number; pct: number | null };
    byCategory: { label: string; cost: number; pct: number | null }[];
  };
}

export interface MenuEngineeringParams extends DateRange {
  scope: MenuScope;
  group?: string;
  popularityFactor: PopularityFactor;
}

export function useGestionMenuEngineering(params: MenuEngineeringParams, enabled = true) {
  return useQuery<MenuEngineeringAnalysis, Error>({
    queryKey: ['gestion', 'menu-engineering', params],
    enabled,
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/menu-engineering`, { params })).data,
    placeholderData: keepPreviousData,
  });
}
