import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateCostingConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetCostPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  theoreticalPriceMultiplier?: number;
}

export interface CostingConfigResponse {
  targetCostPercentage: number;
  theoreticalPriceMultiplier: number;
}
