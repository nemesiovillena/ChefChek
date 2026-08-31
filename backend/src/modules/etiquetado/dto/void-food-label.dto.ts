import { IsOptional, IsString, MaxLength } from "class-validator";

export class VoidFoodLabelDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
