import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export const COMPLIANCE_TRISTATE = ["YES", "NO", "UNKNOWN"] as const;
export type ComplianceTristate = (typeof COMPLIANCE_TRISTATE)[number];

/** Perfil de cumplimiento (PROV.1) — upsert, no append-only. Todo opcional: se rellena progresivamente. */
export class UpsertSupplierComplianceDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suppliedCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceUnits?: string[];

  @IsOptional()
  @IsIn(COMPLIANCE_TRISTATE)
  hasSafetyDataSheets?: ComplianceTristate;

  @IsOptional()
  @IsIn(COMPLIANCE_TRISTATE)
  hasIndustrialRegistry?: ComplianceTristate;

  @IsOptional()
  @IsIn(COMPLIANCE_TRISTATE)
  hasTechnicalSheets?: ComplianceTristate;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualityCertification?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  internalRulesGivenAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  firstContactAt?: Date;
}
