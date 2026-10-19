/**
 * Un tool que el LLM del asistente Chefchek puede invocar. `parameters` es el
 * JSON Schema expuesto al LLM — NUNCA debe incluir `tenantId`: el orquestador
 * lo inyecta siempre desde la sesión del request, jamás desde el LLM.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      { type: string; description: string; enum?: string[] }
    >;
    required?: string[];
  };
  handler: (
    tenantId: string,
    params: Record<string, any>,
    ctx?: ToolContext,
  ) => Promise<unknown>;
}

/** Permisos del rol que hace la pregunta, para que las tools filtren datos. */
export interface ToolContext {
  /** Sección `recipes.drinks`: sin ella las recetas de bebida no existen. */
  canViewDrinks?: boolean;
}
