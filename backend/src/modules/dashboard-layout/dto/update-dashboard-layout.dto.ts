import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator";
import type { DashboardWidgetSlot } from "../dashboard-widgets";
import {
  DASHBOARD_TITLE_MAX_LENGTH,
  DASHBOARD_WIDGET_IDS,
} from "../dashboard-widgets";

/** Pantalla de un dispositivo: título y cards visibles, en orden. */
export class UpdateDashboardLayoutDto {
  @IsString()
  @MaxLength(DASHBOARD_TITLE_MAX_LENGTH)
  title: string;

  /** `{ id, cols (1-3), rows (1-2) }` en orden; el servicio valida cada una. */
  @IsArray()
  @ArrayMaxSize(DASHBOARD_WIDGET_IDS.length)
  widgets: DashboardWidgetSlot[];
}
