import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  MinLength,
  MaxLength,
  IsEnum,
} from "class-validator";

export enum SprintType {
  DEVELOPMENT = "DEVELOPMENT",
  REFACTORING = "REFACTORING",
  DOCUMENTATION = "DOCUMENTATION",
  TESTING = "TESTING",
  INFRASTRUCTURE = "INFRASTRUCTURE",
}

export enum SprintStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  BLOCKED = "BLOCKED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  BLOCKED = "BLOCKED",
}

export enum TaskPriority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

// DTO para crear sprint
export class CreateSprintDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(SprintType)
  type: SprintType;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsObject()
  objectives?: Record<string, any>;

  @IsOptional()
  @IsArray()
  teamMembers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// DTO para actualizar sprint
export class UpdateSprintDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(SprintStatus)
  status?: SprintStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  objectives?: Record<string, any>;

  @IsOptional()
  @IsArray()
  teamMembers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// DTO para crear tarea
export class CreateTaskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsString()
  sprintId: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsArray()
  @IsString()
  dependsOn?: string[];

  @IsOptional()
  @IsObject()
  blockedBy?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// DTO para actualizar tarea
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsArray()
  @IsString()
  dependsOn?: string[];

  @IsOptional()
  @IsObject()
  blockedBy?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
