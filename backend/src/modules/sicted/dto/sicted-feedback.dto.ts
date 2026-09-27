import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export const FEEDBACK_KINDS = ["QUEJA", "SUGERENCIA", "FELICITACION"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_CHANNELS = [
  "SALA",
  "WEB",
  "EMAIL",
  "TELEFONO",
  "OTRO",
] as const;
export type FeedbackChannel = (typeof FEEDBACK_CHANNELS)[number];

/** Queja/sugerencia/felicitación (CLI.3) — captura interna, sin formulario público por QR. */
export class CreateFeedbackDto {
  @IsIn(FEEDBACK_KINDS)
  kind: FeedbackKind;

  @IsIn(FEEDBACK_CHANNELS)
  channel: FeedbackChannel;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  receivedByName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  summary: string;

  /** RGPD: opcional, nunca obligatorio. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerContact?: string;
}

export class RespondFeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  response: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  respondedByName: string;
}

export class CloseFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  improvementActionId?: string;
}
