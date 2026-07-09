import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MinLength,
} from "class-validator";

export class CreateProductSupplierOfferDto {
  @IsString()
  @MinLength(1)
  supplierId: string;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netPrice?: number;

  @IsOptional()
  @IsString()
  purchaseFormat?: string;

  @IsOptional()
  @IsString()
  referenceUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  unitsPerFormat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  referenceUnitSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profitMargin?: number;
}

export class UpdateProductSupplierOfferDto {
  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netPrice?: number;

  @IsOptional()
  @IsString()
  purchaseFormat?: string;

  @IsOptional()
  @IsString()
  referenceUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  unitsPerFormat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  referenceUnitSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profitMargin?: number;
}
