import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePurchaseOrderConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  supplierNote?: string;
}

export interface PurchaseOrderConfigResponse {
  supplierNote: string;
}
