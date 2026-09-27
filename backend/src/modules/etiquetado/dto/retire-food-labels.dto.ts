import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
} from "class-validator";
import { RETIRED_DISPOSITIONS } from "../constants/storage-condition.constant";

export class RetireFoodLabelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(RETIRED_DISPOSITIONS as unknown as string[])
  disposition!: (typeof RETIRED_DISPOSITIONS)[number];
}
