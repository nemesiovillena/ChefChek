import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

/** Códigos de Cuiner: numéricos con ceros a la izquierda (centro "02", proveedor "00009"). */
const CUINER_CODE = /^\d{1,10}$/;

// ─── Usuario (JWT) ──────────────────────────────────────────────────────────

export class UpdateCuinerConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(["DRY_RUN", "LIVE"])
  mode?: "DRY_RUN" | "LIVE";

  @IsOptional()
  @Matches(CUINER_CODE)
  centro?: string;

  @IsOptional()
  @Matches(CUINER_CODE)
  almacen?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(CUINER_CODE)
  actUsuario?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  warehouseId?: string | null;
}

export class SetSupplierMapDto {
  @IsString()
  supplierId!: string;

  @Matches(CUINER_CODE)
  codigo!: string;
}

export class SetProductMapDto {
  @IsString()
  productId!: string;

  @Matches(CUINER_CODE)
  articulo!: string;
}

export class SetDishMapDto {
  /** P plato, I ingrediente/modificador, M menú (el código depende del tipo). */
  @IsIn(["P", "I", "M"])
  tipo!: "P" | "I" | "M";

  @Matches(CUINER_CODE)
  producto!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  recipeId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  productId?: string | null;
}

// ─── Conector (token) ───────────────────────────────────────────────────────

export class CatalogSupplierDto {
  @Matches(CUINER_CODE)
  codigo!: string;

  @IsString()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  razon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cif?: string | null;

  @IsBoolean()
  baja!: boolean;
}

export class CatalogArticleDto {
  @Matches(CUINER_CODE)
  codigo!: string;

  @IsString()
  @MaxLength(200)
  descripcion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  manipulacion?: string | null;

  @IsOptional()
  @IsNumber()
  medida?: number | null;

  @IsBoolean()
  baja!: boolean;
}

export class CatalogArticleSupplierDto {
  @Matches(CUINER_CODE)
  articulo!: string;

  @Matches(CUINER_CODE)
  proveedor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refProveedor?: string | null;

  @IsOptional()
  @IsDateString()
  ultFecha?: string | null;

  @IsOptional()
  @IsNumber()
  ultImporte?: number | null;

  @IsOptional()
  @IsNumber()
  ultIva?: number | null;

  @IsOptional()
  @IsNumber()
  ultUnPorCaja?: number | null;

  @IsOptional()
  @IsBoolean()
  ultImporteUC?: boolean | null;
}

export class CatalogDishDto {
  /** P plato, I ingrediente/modificador, M menú (el código depende del tipo). */
  @IsIn(["P", "I", "M"])
  tipo!: "P" | "I" | "M";

  @Matches(CUINER_CODE)
  producto!: string;

  @IsString()
  @MaxLength(200)
  nombre!: string;
}

/** Lotes acotados: el conector trocea catálogos grandes (≈3.000 artículos). */
export class UploadCatalogDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CatalogSupplierDto)
  suppliers?: CatalogSupplierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CatalogArticleDto)
  articles?: CatalogArticleDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CatalogArticleSupplierDto)
  articleSuppliers?: CatalogArticleSupplierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CatalogDishDto)
  dishes?: CatalogDishDto[];
}

export class SaleLineDto {
  @IsInt()
  @Min(1)
  idVentasCab!: number;

  @IsInt()
  @Min(0)
  linea!: number;

  @IsDateString()
  fecha!: string;

  @IsString()
  @MaxLength(2)
  tipo!: string;

  @IsString()
  @MaxLength(20)
  producto!: string;

  @IsNumber()
  unidades!: number;

  @IsBoolean()
  anulada!: boolean;
}

export class UploadSalesDto {
  /** Id_VentasCab más alto incluido en el lote: nuevo cursor. */
  @IsInt()
  @Min(0)
  cursor!: number;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}

export class BootstrapCursorDto {
  /** MAX(Id_VentasCab) actual en Cuiner: las ventas anteriores no se importan. */
  @IsInt()
  @Min(0)
  maxVentasCabId!: number;
}

export class ExportResultDto {
  @IsBoolean()
  ok!: boolean;

  /** true si se procesó en DRY_RUN (ROLLBACK, nada escrito en Cuiner). */
  @IsBoolean()
  simulated!: boolean;

  @IsOptional()
  @IsInt()
  idDocsCab?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error?: string;
}
