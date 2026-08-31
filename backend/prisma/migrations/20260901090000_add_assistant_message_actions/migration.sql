-- AlterTable
-- Botones de navegación (p.ej. "Abrir receta") adjuntos a mensajes del asistente IA
ALTER TABLE "assistant_messages" ADD COLUMN     "actions" JSONB;
