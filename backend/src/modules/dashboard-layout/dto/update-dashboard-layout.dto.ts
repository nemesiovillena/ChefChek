import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator";
import {
  DASHBOARD_TITLE_MAX_LENGTH,
  DASHBOARD_WIDGET_IDS,
} from "../dashboard-widgets";

/** Pantalla de un dispositivo: título y cards visibles, en orden. */
export class UpdateDashboardLayoutDto {
  @IsString()
  @MaxLength(DASHBOARD_TITLE_MAX_LENGTH)
  title: string;

  @IsArray()
  @ArrayMaxSize(DASHBOARD_WIDGET_IDS.length)
  @IsString({ each: true })
  widgets: string[];
}
