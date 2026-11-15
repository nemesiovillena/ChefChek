-- Rol de oficina: módulo Gestión, Albaranes, Proveedores y Personal; Compras solo consulta.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GESTION';
