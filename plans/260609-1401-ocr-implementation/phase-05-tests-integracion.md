---
title: "Phase 05: Tests de Integración y E2E"
description: "Crear tests de integración para el flujo completo de procesamiento de documentos OCR"
status: pending
priority: P2
effort: 1h
tags: [testing, integration-tests, e2e]
created: 2026-06-09
---

## Overview

Crear tests de integración que validen el flujo completo desde la recepción de un documento hasta la extracción de productos y actualización en cascada.

## Requerimientos

### Funcionales
- Test de integración para creación de documento
- Test de integración para procesamiento de documento
- Test de integración para actualización en cascada
- Test E2E de frontend a backend

### No-Funcionales
- Tests aislados (usar base de datos de test)
- Limpieza después de cada test
- Timeouts adecuados

## Architecture

```
Integration Test Flow
├── Create Document
│   ├── POST /api/v1/ingesta/document
│   ├── Document created in DB
│   └── Job enqueued
├── Process Document
│   ├── Bull Queue processes job
│   ├── OCR extracts text
│   ├── Products extracted
│   └── Document updated
└── Cascade Update
    ├── Products created/updated
    ├── Recipes recalculated
    └── Menus recalculated
```

## Files to Create

### backend/src/modules/ingesta/ingesta.integration.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IngestaModule } from './ingesta.module';
import { DocumentStatus, DocumentType } from './dto/ingesta.dto';

describe('Ingesta Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [IngestaModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Limpiar datos de test
    await prisma.extractedProduct.deleteMany({});
    await prisma.document.deleteMany({});
  });

  describe('Document Processing Flow', () => {
    it('should create and process a document successfully', async () => {
      const tenantId = 'test-tenant-id';

      // Crear documento
      const document = await prisma.document.create({
        data: {
          tenantId,
          name: 'Test Invoice',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-123',
          source: 'api',
          status: DocumentStatus.PENDING,
        },
      });

      expect(document.id).toBeDefined();
      expect(document.status).toBe(DocumentStatus.PENDING);

      // Procesar documento (manual para test, en prod usa queue)
      // Este test valida la estructura, el procesamiento real
      // se valida en tests unitarios de los servicios OCR
    });

    it('should update document status after processing', async () => {
      const tenantId = 'test-tenant-id';

      const document = await prisma.document.create({
        data: {
          tenantId,
          name: 'Test Invoice',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-123',
          source: 'api',
          status: DocumentStatus.PENDING,
        },
      });

      // Actualizar a PROCESSING
      const updated = await prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PROCESSING },
      });

      expect(updated.status).toBe(DocumentStatus.PROCESSING);

      // Actualizar a COMPLETED con datos OCR
      const completed = await prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.COMPLETED,
          ocrData: { text: 'Test OCR text', confidence: 0.85 },
        },
      });

      expect(completed.status).toBe(DocumentStatus.COMPLETED);
      expect(completed.ocrData).toBeDefined();
    });

    it('should handle document processing failure', async () => {
      const tenantId = 'test-tenant-id';

      const document = await prisma.document.create({
        data: {
          tenantId,
          name: 'Test Invoice',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-123',
          source: 'api',
          status: DocumentStatus.PENDING,
        },
      });

      // Actualizar a FAILED
      const failed = await prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: 'OCR processing failed: API rate limit exceeded',
        },
      });

      expect(failed.status).toBe(DocumentStatus.FAILED);
      expect(failed.errorMessage).toContain('OCR processing failed');
    });
  });

  describe('Extracted Products', () => {
    it('should create extracted products linked to document', async () => {
      const tenantId = 'test-tenant-id';

      const document = await prisma.document.create({
        data: {
          tenantId,
          name: 'Test Invoice',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-123',
          source: 'api',
          status: DocumentStatus.COMPLETED,
          extractedProducts: {
            create: [
              {
                name: 'Tomate',
                description: 'Producto importado',
                quantity: 50,
                unit: 'kg',
                unitPrice: 2.50,
                supplier: 'Proveedor A',
                category: 'Vegetales',
                confidence: 0.92,
              },
            ],
          },
        },
      });

      expect(document.extractedProducts).toHaveLength(1);
      expect(document.extractedProducts[0].name).toBe('Tomate');
      expect(document.extractedProducts[0].confidence).toBe(0.92);
    });

    it('should query documents with extracted products', async () => {
      const tenantId = 'test-tenant-id';

      const document = await prisma.document.create({
        data: {
          tenantId,
          name: 'Test Invoice',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-123',
          source: 'api',
          status: DocumentStatus.COMPLETED,
          extractedProducts: {
            create: [
              {
                name: 'Tomate',
                quantity: 50,
                unit: 'kg',
                unitPrice: 2.50,
                confidence: 0.92,
              },
            ],
          },
        },
      });

      const queried = await prisma.document.findFirst({
        where: { id: document.id },
        include: { extractedProducts: true },
      });

      expect(queried).toBeDefined();
      expect(queried!.extractedProducts).toHaveLength(1);
    });
  });

  describe('Document Query', () => {
    it('should filter documents by status', async () => {
      const tenantId = 'test-tenant-id';

      await prisma.document.createMany({
        data: [
          {
            tenantId,
            name: 'Pending Document',
            type: DocumentType.INVOICE,
            category: 'INGESTA',
            version: 1,
            createdBy: 'SYSTEM',
            fileSize: 0,
            fileFormat: 'PDF',
            url: 'https://example.com/test.pdf',
            fileUrl: 'https://example.com/test.pdf',
            fileName: 'test.pdf',
            fileId: 'file-1',
            source: 'api',
            status: DocumentStatus.PENDING,
          },
          {
            tenantId,
            name: 'Completed Document',
            type: DocumentType.INVOICE,
            category: 'INGESTA',
            version: 1,
            createdBy: 'SYSTEM',
            fileSize: 0,
            fileFormat: 'PDF',
            url: 'https://example.com/test.pdf',
            fileUrl: 'https://example.com/test.pdf',
            fileName: 'test.pdf',
            fileId: 'file-2',
            source: 'api',
            status: DocumentStatus.COMPLETED,
          },
        ],
      });

      const pending = await prisma.document.findMany({
        where: { tenantId, status: DocumentStatus.PENDING },
      });

      const completed = await prisma.document.findMany({
        where: { tenantId, status: DocumentStatus.COMPLETED },
      });

      expect(pending).toHaveLength(1);
      expect(completed).toHaveLength(1);
    });

    it('should query documents with date range', async () => {
      const tenantId = 'test-tenant-id';

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.document.create({
        data: {
          tenantId,
          name: 'Old Document',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-1',
          source: 'api',
          status: DocumentStatus.COMPLETED,
          createdAt: yesterday,
        },
      });

      await prisma.document.create({
        data: {
          tenantId,
          name: 'New Document',
          type: DocumentType.INVOICE,
          category: 'INGESTA',
          version: 1,
          createdBy: 'SYSTEM',
          fileSize: 0,
          fileFormat: 'PDF',
          url: 'https://example.com/test.pdf',
          fileUrl: 'https://example.com/test.pdf',
          fileName: 'test.pdf',
          fileId: 'file-2',
          source: 'api',
          status: DocumentStatus.PENDING,
        },
      });

      const recent = await prisma.document.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 12 * 60 * 60 * 1000), // Last 12 hours
          },
        },
      });

      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe('New Document');
    });
  });
});
```

## Frontend E2E Test

### frontend/__tests__/ocr-e2e.spec.ts

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock de API
global.fetch = jest.fn();

import OcrAiPage from '@/app/dashboard/ocr-ai/page';

describe('OCR AI Page E2E', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    (global.fetch as jest.Mock).mockClear();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <OcrAiPage />
      </QueryClientProvider>
    );
  };

  describe('Initial Load', () => {
    it('should render OCR AI page title', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('OCR + IA')).toBeInTheDocument();
      });
    });

    it('should render processing step by default', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Procesamiento')).toBeInTheDocument();
      });
    });
  });

  describe('Step Navigation', () => {
    it('should navigate between steps', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Procesamiento')).toBeInTheDocument();
      });

      // Click on second step
      const extractionButton = await screen.findByText('Extracciones');
      await user.click(extractionButton);

      await waitFor(() => {
        expect(screen.getByText('Extracciones IA')).toBeInTheDocument();
      });
    });
  });

  describe('OCR Configuration', () => {
    it('should display OCR provider selector', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Proveedor de OCR')).toBeInTheDocument();
      });
    });

    it('should display language selector', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Idioma del Documento')).toBeInTheDocument();
      });
    });
  });

  describe('Extractions Display', () => {
    it('should display mock extractions', async () => {
      renderPage();

      // Navigate to extractions step
      const user = userEvent.setup();
      const extractionButton = await screen.findByText('Extracciones');
      await user.click(extractionButton);

      await waitFor(() => {
        expect(screen.getByText('Extracciones IA')).toBeInTheDocument();
        expect(screen.getByText('factura_proveedor_20260531.pdf')).toBeInTheDocument();
      });
    });
  });
});
```

## Implementation Steps

1. Crear `ingesta.integration.spec.ts`
2. Crear `frontend/__tests__/ocr-e2e.spec.ts`
3. Ejecutar tests de integración: `npm run test:e2e`
4. Verificar que todos los tests pasan
5. Verificar que no hay fugas de memoria en tests

## Testing Strategy

### Integration Test Matrix

| Flujo | Casos de Prueba |
|-------|-----------------|
| Crear documento | éxito, error validación |
| Procesar documento | success, failure, retry |
| Extraer productos | crear, vincular, consultar |
| Consultar documentos | filtrar por status, fecha, tipo |

### E2E Test Matrix

| Característica | Casos de Prueba |
|---------------|-----------------|
| Navegación pasos | cambio de paso, estado activo |
| Configuración OCR | selector proveedor, idioma |
| Display extracciones | mostrar mock data, filtrar |

## Success Criteria

- [ ] Tests de integración pasan
- [ ] Tests E2E pasan
- [ ] Tests limpian datos correctamente
- [ ] Sin fugas de memoria

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| Tests dependen de DB externa | Usar Prisma con DATABASE_URL de test |
| Tests lentos por Redis | Mock Bull queue en tests de integración |

## Rollback Plan

Si tests fallan:
1. Verificar configuración de base de datos de test
2. Verificar mocks de dependencias externas
3. Revertir a implementación anterior si crítico

## Next Steps

→ Verificación final y documentación