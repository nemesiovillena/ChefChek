import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreatePurchaseScheduleDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  listId: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  // 0=domingo … 6=sábado (Date.getDay() de JS)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, {
    message: "timeOfDay debe tener formato HH:mm (24h)",
  })
  timeOfDay: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * Programar pedidos recurrentes tomando como plantilla un pedido existente:
 * sus artículos de catálogo se copian a una lista de compra nueva y esa lista
 * queda programada con estos días/hora.
 */
export class SchedulePurchaseOrderDto {
  // 0=domingo … 6=sábado (Date.getDay() de JS)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, {
    message: "timeOfDay debe tener formato HH:mm (24h)",
  })
  timeOfDay: string;

  // Nombre de la lista de compra que se creará; por defecto "Pedido PED-N".
  @IsOptional()
  @IsString()
  @MaxLength(120)
  listName?: string;
}

export class UpdatePurchaseScheduleDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, {
    message: "timeOfDay debe tener formato HH:mm (24h)",
  })
  timeOfDay?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
