/**
 * Acciones de navegación que una tool puede adjuntar a su resultado
 * (`action`) para que la respuesta del asistente lleve botones asociados
 * (p.ej. "Abrir receta" → ficha en el frontend). El tipo de acción lo
 * interpreta el frontend; el backend solo lo transporta y persiste.
 */
export interface AssistantAction {
  type: "open_recipe";
  recipeId: string;
  label: string;
}

/**
 * Extrae la acción de navegación del resultado de una tool, si lo lleva.
 * Convención: `result.action = { type, recipeId, label }`. Cualquier forma
 * que no case con una acción conocida se ignora (nunca rompe el turno).
 */
export function extractAssistantAction(
  result: unknown,
): AssistantAction | null {
  if (!result || typeof result !== "object") {
    return null;
  }
  const action = (result as { action?: unknown }).action;
  if (!action || typeof action !== "object") {
    return null;
  }
  const { type, recipeId, label } = action as Record<string, unknown>;
  if (
    type === "open_recipe" &&
    typeof recipeId === "string" &&
    typeof label === "string"
  ) {
    return { type, recipeId, label };
  }
  return null;
}
