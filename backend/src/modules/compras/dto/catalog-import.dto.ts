import { IsIn, IsOptional, IsString } from "class-validator";
import { CatalogLineStatus } from "@prisma/client";

export class UpdateCatalogImportLineDto {
  @IsIn(["ACEPTADA", "RECHAZADA", "PROPUESTA"])
  lineStatus: CatalogLineStatus;

  @IsOptional()
  @IsString()
  matchedProductId?: string;
}
