export class PriceTrendDto {
  status: "increased" | "decreased" | "stable";
  percentage: number;
  lastPrice: number;
  currentPrice: number;
}
