import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Configuración del motor de extracción IA de albaranes, guardada por tenant.
 * Ambos campos son opcionales: omitirlos deja el valor existente tal cual
 * (permite cambiar el modelo sin retipear la API key, y viceversa).
 */
export class OcrConfigDto {
  /** Id de modelo (OCR_MODELS) o "regex". Undefined = no cambiar el modelo. */
  @IsString()
  @IsOptional()
  model?: string;

  /** API key del provider del modelo. Vacío/undefined = conservar la existente. */
  @IsString()
  @MaxLength(512)
  @IsOptional()
  apiKey?: string;
}

/** Vista pública de la config: nunca expone la API key, solo si hay una guardada. */
export interface OcrConfigPublic {
  model: string; // "regex" si no hay nada configurado
  hasApiKey: boolean;
}
