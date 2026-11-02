import { Type } from "class-transformer";
import {
  IsEmail,
  IsFQDN,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Credenciales IMAP del buzón del restaurante. Siempre TLS (no hay campo
 * `secure`): IMAP en 993 y SMTP en 465 (SSL) o 587 (STARTTLS obligatorio). El host debe ser un nombre de dominio público: las IPs y los
 * nombres internos se rechazan aquí y, tras resolver DNS, al conectar.
 */
export class ImapConfigDto {
  @IsString()
  @IsFQDN(
    { require_tld: true },
    { message: "El servidor debe ser un dominio, p. ej. imap.hostinger.com" },
  )
  @MaxLength(255)
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsEmail(
    {},
    { message: "El usuario debe ser la dirección de correo del buzón" },
  )
  @MaxLength(255)
  user: string;

  /** Servidor de salida (envío). Omitido → smtp.hostinger.com:465. */
  @IsOptional()
  @IsString()
  @IsFQDN(
    { require_tld: true },
    {
      message:
        "El servidor de salida debe ser un dominio, p. ej. smtp.hostinger.com",
    },
  )
  @MaxLength(255)
  smtpHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([465, 587], {
    message: "El puerto de salida debe ser 465 (SSL) o 587 (STARTTLS)",
  })
  smtpPort?: number;

  /** Vacío u omitido → se conserva la contraseña guardada. Nunca se devuelve. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pass?: string;
}
