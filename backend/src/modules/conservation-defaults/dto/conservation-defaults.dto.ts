import { IsNumber, IsOptional } from "class-validator";

export class ConservationDefaultsDto {
  @IsOptional()
  @IsNumber()
  refrigeratedTempMin?: number;

  @IsOptional()
  @IsNumber()
  refrigeratedTempMax?: number;

  @IsOptional()
  @IsNumber()
  refrigeratedShelfLifeDays?: number;

  @IsOptional()
  @IsNumber()
  frozenTempMin?: number;

  @IsOptional()
  @IsNumber()
  frozenTempMax?: number;

  @IsOptional()
  @IsNumber()
  frozenShelfLifeDays?: number;
}

export interface ConservationConditionDefaults {
  tempMin: number;
  tempMax: number;
  shelfLifeDays: number;
}

export interface ConservationDefaultsPublic {
  refrigerated: ConservationConditionDefaults;
  frozen: ConservationConditionDefaults;
}
