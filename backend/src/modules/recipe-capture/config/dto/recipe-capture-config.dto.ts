import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import {
  AI_ASSISTANT_PROVIDERS,
  AiAssistantProvider,
} from "../../../ai-assistant/config/dto/ai-assistant-config.dto";

/**
 * Configuración del modelo IA que usa la Captura de recetas, guardada por
 * tenant. Independiente de la del Asistente IA: permite tener un modelo propio
 * (p. ej. uno con visión para leer fotos/PDF) sin cambiar el del chat.
 * Todos los campos son opcionales: omitirlos conserva el valor existente.
 */
export class RecipeCaptureConfigDto {
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
export interface RecipeCaptureConfigPublic {
  provider: AiAssistantProvider | null;
  model: string | null;
  hasApiKey: boolean;
  /** Proveedor, modelo y clave presentes: se puede llamar a la IA. */
  isReady: boolean;
}

/** Vista interna resuelta (con la key descifrada) para llamar al proveedor. */
export interface RecipeCaptureConfigResolved {
  provider: AiAssistantProvider;
  model: string;
  apiKey: string;
}
