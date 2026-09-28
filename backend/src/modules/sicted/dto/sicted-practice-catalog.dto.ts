import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/** Edición de una práctica del catálogo por el tenant (título, obligatoriedad). */
export class UpdateSictedPracticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

/** Módulos complementarios que aplican (claves de grupo de la Guía de configuración). */
export class UpdateSictedComplementaryGroupsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  groupKeys: string[];
}
