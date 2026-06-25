export class StockAlertSummaryDto {
  total: number;
  low: number; // quantity <= minimumStock && quantity > 0
  empty: number; // quantity <= 0
}
