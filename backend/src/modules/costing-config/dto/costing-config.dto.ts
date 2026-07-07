import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateCostingConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetCostPercentage?: number;
}

export interface CostingConfigResponse {
  targetCostPercentage: number;
}
