import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Objeto perdido (Ins-Bas.17, agrupado con Clientes) — campos confirmados contra el formulario real. */
export class CreateLostItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  itemName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  foundLocation?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  foundByName: string;
}

export class ReturnLostItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  returnedTo: string;
}
