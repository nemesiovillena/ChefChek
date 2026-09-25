import { Type } from "class-transformer";
import {
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Protocolo (Personas) — imagen/higiene personal/uniformidad, bienvenida,
 * etc. `body` XOR `knowledgeArticleId`: contenido propio o enlace a la Wiki
 * (`conocimiento`, solo lectura, sin relación Prisma — mismo desacoplo que
 * el resto del módulo).
 */
export class CreateProtocolDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  area: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsString()
  knowledgeArticleId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reviewDueAt?: Date;
}

/** Edición de metadatos — NO cambia `version`, no invalida acuses existentes. */
export class UpdateProtocolMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reviewDueAt?: Date;
}

/** Publica una nueva versión de contenido — incrementa `version`, invalida los acuses de la anterior. */
export class PublishProtocolVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsString()
  knowledgeArticleId?: string;
}
