import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

/** Claves de color; el frontend las traduce a clases con variante oscura. */
export const NOTE_TAG_COLORS = [
  "sky",
  "amber",
  "emerald",
  "rose",
  "violet",
  "orange",
  "slate",
] as const;
export type NoteTagColor = (typeof NOTE_TAG_COLORS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateNoteTagDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsIn([...NOTE_TAG_COLORS])
  color!: NoteTagColor;
}

export class UpdateNoteTagDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsIn([...NOTE_TAG_COLORS])
  color?: NoteTagColor;
}

/** Lista completa de ids en el orden nuevo. */
export class ReorderNoteTagsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];
}
