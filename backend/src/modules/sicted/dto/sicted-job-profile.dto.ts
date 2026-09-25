import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/** Ficha de puesto (Personas) — tareas y responsabilidades exactas de cada puesto de trabajo. */
export class CreateJobProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mission?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tasks?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reportsTo?: string;
}

export class UpdateJobProfileDto extends CreateJobProfileDto {}

export class AssignJobProfileDto {
  @IsString()
  @MinLength(1)
  userId: string;
}
