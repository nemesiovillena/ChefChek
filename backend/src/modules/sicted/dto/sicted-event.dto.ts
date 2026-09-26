import {
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

const EVENT_KINDS = [
  "GRUPO_MEJORA",
  "FORMACION_DESTINO",
  "EVALUACION_EXTERNA",
  "OTRO",
];

/** Participación en un evento (grupo de mejora, formación del destino, evaluación externa) — append-only. */
export class CreateEventDto {
  @IsIn(EVENT_KINDS)
  kind: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsDate()
  @Type(() => Date)
  eventDate: Date;

  // El formulario llega vía multipart/form-data cuando incluye adjunto — todo
  // es string ahí, incluido "true"/"false" para un checkbox. Sin este
  // Transform, @IsBoolean() rechaza el string y la creación del evento
  // falla siempre que se use FormData (bug real, cazado en navegador).
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value === "true" : value,
  )
  @IsBoolean()
  attended?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
