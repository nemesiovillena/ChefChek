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
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  REPORT_GROUP_BY,
  ReportGroupBy,
} from "../cuiner-sales-report-grouping";
import {
  SALES_REPORT_FORMATS,
  SalesReportFormat,
} from "../cuiner-sales-report-export.service";

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

  /** Solo con productId: cuánto sale del artículo en cada venta. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  servingMeasureId?: string | null;

  /** Plato que no descuenta stock (cabecera a 0 € con el tamaño en un modificador). */
  @IsOptional()
  @IsBoolean()
  noStock?: boolean;
}

export class SetDishMapsBulkDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SetDishMapDto)
  items!: SetDishMapDto[];
}

export class CreateServingMeasureDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @MaxLength(10)
  unit!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  keywords?: string[];
}

export class UpdateServingMeasureDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  keywords?: string[];
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

  /** Ruta de familia de la carta («BEBIDAS ALCOHOL-LICORES-TUBO L»). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  familia?: string | null;
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

  // Opcionales: un conector antiguo no los envía.
  @IsOptional()
  @IsNumber()
  base?: number;

  @IsOptional()
  @IsNumber()
  impuesto?: number;

  @IsOptional()
  @IsBoolean()
  invitacion?: boolean;
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

/** Lote del histórico: tickets anteriores al conector, de más nuevo a más viejo. */
export class UploadSalesHistoryDto {
  /** Id_VentasCab más bajo incluido en el lote: nuevo tope del histórico. */
  @IsInt()
  @Min(0)
  cursor!: number;

  /** No quedan tickets más antiguos en Cuiner. */
  @IsBoolean()
  done!: boolean;

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

// ─── Informe de ventas ───────────────────────────────────────────────────────

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class SalesReportQueryDto {
  @Matches(ISO_DAY)
  from!: string;

  @Matches(ISO_DAY)
  to!: string;

  @IsIn(REPORT_GROUP_BY)
  groupBy!: ReportGroupBy;

  /** 1-3 nivel de familia, 4 plato a plato. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  level!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  family?: string;
}

export class SalesReportExportQueryDto extends SalesReportQueryDto {
  @IsIn(SALES_REPORT_FORMATS)
  format!: SalesReportFormat;
}
