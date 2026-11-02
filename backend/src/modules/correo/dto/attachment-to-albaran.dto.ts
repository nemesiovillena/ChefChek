import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

/** Pasar un adjunto del correo a albarán: dónde está el correo y, si hay, el pedido que recibe. */
export class AttachmentToAlbaranDto {
  @IsString()
  @MaxLength(500)
  folder: string;

  @Matches(/^\d+$/)
  uidValidity: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  purchaseOrderId?: string;
}
