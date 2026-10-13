import { EmployeeDocumentCategory } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Campos de la subida (multipart/form-data): llegan todos como texto, también
 * los booleanos y la lista de personas.
 */
export class UploadEmployeeDocumentDto {
  /** Ids de ficha separados por comas: el mismo documento para varias personas. */
  @IsString()
  @MinLength(1)
  employeeIds: string;

  @IsEnum(EmployeeDocumentCategory)
  category: EmployeeDocumentCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsIn(["true", "false"])
  requiresAck?: string;

  @IsOptional()
  @Matches(DATE, { message: "expiresAt debe ser AAAA-MM-DD." })
  expiresAt?: string;
}

/** Justificante que sube el propio empleado. */
export class UploadOwnDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;
}
