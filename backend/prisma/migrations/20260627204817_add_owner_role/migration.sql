-- Add OWNER role to UserRole enum
-- OWNER is a privileged role that can manage modules and payments

ALTER TYPE "UserRole" ADD VALUE 'OWNER';