-- Portal del empleado: documentación laboral y acuses de lectura.
-- Solo aditivo. Los acuses son evidencia inalterable (append-only).

-- CreateEnum
CREATE TYPE "EmployeeDocumentCategory" AS ENUM ('CONTRATO', 'JUSTIFICANTE', 'FORMACION', 'PRL', 'OTRO');

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "EmployeeDocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "uploadedByEmployee" BOOLEAN NOT NULL DEFAULT false,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATE,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_document_acks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "ackAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "employee_document_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_documents_tenantId_employeeId_idx" ON "employee_documents"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_document_acks_documentId_key" ON "employee_document_acks"("documentId");

-- CreateIndex
CREATE INDEX "employee_document_acks_tenantId_employeeId_idx" ON "employee_document_acks"("tenantId", "employeeId");

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inalterabilidad
CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "employee_document_acks"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
