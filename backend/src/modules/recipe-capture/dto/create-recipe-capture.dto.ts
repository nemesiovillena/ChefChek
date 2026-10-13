import {
  IsIn,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

/** Texto máximo que se envía a la IA desde una captura por texto pegado. */
export const MAX_CAPTURE_TEXT_LENGTH = 20_000;

export class CreateRecipeCaptureDto {
  @IsIn(["URL", "TEXTO"])
  source: "URL" | "TEXTO";

  @ValidateIf((dto: CreateRecipeCaptureDto) => dto.source === "URL")
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  url?: string;

  @ValidateIf((dto: CreateRecipeCaptureDto) => dto.source === "TEXTO")
  @IsString()
  @MinLength(20)
  @MaxLength(MAX_CAPTURE_TEXT_LENGTH)
  text?: string;
}
