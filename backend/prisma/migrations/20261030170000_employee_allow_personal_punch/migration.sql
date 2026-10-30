-- Permiso por persona para fichar desde su propia cuenta (por defecto, sí).
ALTER TABLE "employees" ADD COLUMN "allowPersonalPunch" BOOLEAN NOT NULL DEFAULT true;
