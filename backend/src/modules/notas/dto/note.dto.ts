import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateIf,
} from "class-validator";
import { Transform, Type } from "class-transformer";

/** Valida si viene el campo, aunque sea null (null en un campo obligatorio = 400). */
const presentOrNull = (_: unknown, value: unknown) => value !== undefined;

/** Fecha con hora (lo que manda el frontend); descarta formatos ISO raros como semanas. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** '' de un campo opcional dejado en blanco → undefined (o null al editar). */
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export const NOTE_BODY_MAX = 5000;
export const NOTE_TITLE_MAX = 120;
export const NOTE_PERSON_NAME_MAX = 80;

export class CreateNoteDto {
  @Transform(trimOrUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(NOTE_BODY_MAX)
  body!: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(NOTE_TITLE_MAX)
  title?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsISO8601()
  @Matches(ISO_DATE_TIME, { message: "remindAt debe ser fecha y hora ISO" })
  remindAt?: string;

  @IsOptional()
  @IsBoolean()
  remindHasTime?: boolean;

  /** «Quién» escribe la nota; obligatorio en cuenta compartida. */
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(NOTE_PERSON_NAME_MAX)
  byName?: string;
}

/** En edición, null borra el campo opcional (título, etiqueta, aviso). */
export class UpdateNoteDto {
  @ValidateIf(presentOrNull)
  @Transform(trimOrUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(NOTE_BODY_MAX)
  body?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(NOTE_TITLE_MAX)
  title?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  tagId?: string | null;

  @ValidateIf(presentOrNull)
  @IsBoolean()
  isPrivate?: boolean;

  @ValidateIf(presentOrNull)
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @Transform(trimOrNull)
  @IsISO8601()
  @Matches(ISO_DATE_TIME, { message: "remindAt debe ser fecha y hora ISO" })
  remindAt?: string | null;

  @ValidateIf(presentOrNull)
  @IsBoolean()
  remindHasTime?: boolean;
}

export class MarkNoteDoneDto {
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(NOTE_PERSON_NAME_MAX)
  byName?: string;
}

export class ListNotesQueryDto {
  @IsOptional()
  @IsIn(["pending", "done"])
  status?: "pending" | "done";

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  tagId?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class NoteHighlightsQueryDto {
  /** "1" en dispositivos compartidos: nunca incluir notas privadas. */
  @IsOptional()
  @IsIn(["1", "0"])
  shared?: "1" | "0";
}
