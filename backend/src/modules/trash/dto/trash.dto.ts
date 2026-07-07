import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, IsNotEmpty } from "class-validator";

/** Tipos de entidad con soft-delete cubiertos por la papelera. */
export const TRASH_TYPES = [
  "product",
  "recipe",
  "albaran",
  "category",
  "supplier",
  "user",
  "sprint",
  "task",
  "warehouse",
] as const;

export type TrashType = (typeof TRASH_TYPES)[number];

export class TrashQueryDto {
  @ApiProperty({ enum: TRASH_TYPES, example: "product" })
  @IsEnum(TRASH_TYPES)
  type: TrashType;
}

/** Cuerpo opcional para validar parámetros de ruta :type */
export class TrashTypeParamDto {
  @ApiProperty({ enum: TRASH_TYPES })
  @IsEnum(TRASH_TYPES)
  @IsString()
  @IsNotEmpty()
  type: TrashType;
}
