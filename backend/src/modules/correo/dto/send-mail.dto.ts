import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

/**
 * Envío desde el buzón (multipart: los adjuntos van en `files`). Los
 * destinatarios llegan como texto separado por comas y se validan en el
 * servicio. `ref*` identifica el correo original al responder o reenviar.
 */
export class SendMailDto {
  @IsIn(["new", "reply", "replyAll", "forward"])
  mode: "new" | "reply" | "replyAll" | "forward";

  @IsString()
  @MaxLength(5000)
  to: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  cc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bcc?: string;

  @IsString()
  @MaxLength(500)
  subject: string;

  @IsString()
  @MaxLength(200_000)
  text: string;

  @ValidateIf((o) => o.mode !== "new")
  @IsString()
  @MaxLength(500)
  refFolder?: string;

  @ValidateIf((o) => o.mode !== "new")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  refUid?: number;

  @ValidateIf((o) => o.mode !== "new")
  @Matches(/^\d+$/)
  refUidValidity?: string;
}
