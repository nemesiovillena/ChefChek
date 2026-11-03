import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import {
  PORTION_LOAD_SOURCES,
  type PortionLoadSource,
} from "../services/portion-settings.service";

export class UpdatePortionSettingsDto {
  @IsOptional()
  @IsIn([...PORTION_LOAD_SOURCES])
  loadSource?: PortionLoadSource;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  doubleLoadHours?: number;
}
