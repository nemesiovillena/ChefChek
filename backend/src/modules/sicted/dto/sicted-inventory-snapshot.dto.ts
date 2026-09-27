import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Sello de inventario semestral (PROV.7) — solo firma; los datos salen de `Stock` en el momento. */
export class CreateInventorySnapshotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  performedByName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
