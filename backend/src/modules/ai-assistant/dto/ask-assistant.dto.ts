import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class AskAssistantDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
