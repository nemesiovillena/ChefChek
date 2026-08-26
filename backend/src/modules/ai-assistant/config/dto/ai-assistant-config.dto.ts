import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const AI_ASSISTANT_PROVIDERS = [
  "openai",
  "gemini",
  "anthropic",
] as const;
export type AiAssistantProvider = (typeof AI_ASSISTANT_PROVIDERS)[number];

/**
 * Configuración del proveedor IA del asistente "Chefchek", guardada por tenant.
 * Todos los campos son opcionales: omitirlos deja el valor existente tal cual
 * (permite cambiar de modelo sin retipear la API key, y viceversa) — mismo
 * comportamiento que OcrConfigDto.
 */
export class AiAssistantConfigDto {
  @IsIn(AI_ASSISTANT_PROVIDERS)
  @IsOptional()
  provider?: AiAssistantProvider;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  model?: string;

  /** API key del proveedor. Vacío/undefined = conservar la existente. */
  @IsString()
  @MaxLength(512)
  @IsOptional()
  apiKey?: string;
}

/** Vista pública de la config: nunca expone la API key, solo si hay una guardada. */
export interface AiAssistantConfigPublic {
  provider: AiAssistantProvider | null;
  model: string | null;
  hasApiKey: boolean;
}

/** Vista interna resuelta (con la key descifrada) para el orquestador. */
export interface AiAssistantConfigResolved {
  provider: AiAssistantProvider;
  model: string;
  apiKey: string;
}
