# Supplier Database Integration Guide - ChefChek OCR

## Overview

Integración del sistema OCR con la base de datos de proveedores para validación automática, enriquecimiento de datos y reducción de errores en el procesamiento de albaranes.

## Architecture

```
┌─────────────────────┐
│  OCR Pipeline       │
│  (Product Extract)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Supplier Info      │
│  (Name, CIF/NIF)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Validation Service │
│  (Business Rules)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────┐
│  PostgreSQL Cache   │────▶│  Supplier DB    │
│  (Redis/In-Memory)  │     │  (Prisma ORM)   │
└──────────┬──────────┘     └─────────────────┘
           │
           ▼
┌─────────────────────┐
│  Enriched Data      │
│  (Validated + IDs)  │
└─────────────────────┘
```

## Database Schema

### Prisma Supplier Model

**File:** `backend/prisma/schema.prisma`

```prisma
model Supplier {
  id            String    @id @default(cuid())
  name          String    @unique
  cif           String?   @unique
  nif           String?   @unique
  email         String?
  phone         String?
  address       String?
  city          String?
  country       String    @default("Spain")
  taxRate       Float     @default(0.21)
  paymentTerms  Int       @default(30) // days
  status        SupplierStatus @default(ACTIVE)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  products      Product[]
  ingesta       Ingesta[]
  priceHistory  SupplierPriceHistory[]

  @@index([cif])
  @@index([nif])
  @@index([name])
  @@index([status])
}

enum SupplierStatus {
  ACTIVE
  INACTIVE
  PENDING
  BLOCKED
}

model SupplierPriceHistory {
  id            String    @id @default(cuid())
  supplierId    String
  productId     String
  price         Float
  unitPrice     Float?
  validFrom     DateTime  @default(now())
  validTo       DateTime?

  supplier      Supplier  @relation(fields: [supplierId], references: [id])
  product       Product   @relation(fields: [productId], references: [id])

  @@index([supplierId, productId])
  @@index([validFrom, validTo])
}
```

## Backend Implementation

### 1. Supplier Validation Controller

**File:** `backend/src/modules/suppliers/suppliers.controller.ts`

```typescript
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('api/v1/suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post('validate-cif')
  async validateCIF(@Body('cif') cif: string) {
    return this.suppliersService.validateByCif(cif);
  }

  @Get('search')
  async searchSupplier(
    @Query('name') name: string,
    @Query('limit') limit: number = 5
  ) {
    return this.suppliersService.searchByName(name, limit);
  }

  @Get(':id/price-history')
  async getPriceHistory(
    @Param('id') id: string,
    @Query('productId') productId?: string
  ) {
    return this.suppliersService.getPriceHistory(id, productId);
  }
}
```

### 2. Supplier Service

**File:** `backend/src/modules/suppliers/suppliers.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupplierStatus } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida proveedor por CIF exacto
   * @param cif - CIF del proveedor
   * @returns Información del proveedor con alta confianza
   */
  async validateByCif(cif: string) {
    // Normalizar CIF (quitar guiones, espacios)
    const normalizedCif = cif.replace(/[-\s]/g, '').toUpperCase();

    const supplier = await this.prisma.supplier.findUnique({
      where: { cif: normalizedCif },
      select: {
        id: true,
        name: true,
        cif: true,
        status: true,
        taxRate: true,
        paymentTerms: true
      }
    });

    if (!supplier) {
      return {
        valid: false,
        message: 'Proveedor no encontrado con este CIF',
        confidence: 0
      };
    }

    if (supplier.status !== SupplierStatus.ACTIVE) {
      return {
        valid: false,
        message: `Proveedor no activo: ${supplier.status}`,
        confidence: 0.5
      };
    }

    return {
      valid: true,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      cif: supplier.cif,
      status: supplier.status,
      taxRate: supplier.taxRate,
      paymentTerms: supplier.paymentTerms,
      confidence: 0.95
    };
  }

  /**
   * Busca proveedor por nombre aproximado
   * @param name - Nombre del proveedor
   * @param limit - Número máximo de resultados
   * @returns Lista de proveedores ordenados por similitud
   */
  async searchByName(name: string, limit: number = 5) {
    const normalizedSearch = name.toLowerCase().trim();

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        status: SupplierStatus.ACTIVE,
        name: {
          contains: normalizedSearch,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        cif: true,
        nif: true,
        email: true,
        phone: true
      },
      take: limit
    });

    // Calcular score de similitud
    const scored = suppliers.map(supplier => ({
      ...supplier,
      score: this.calculateSimilarityScore(normalizedSearch, supplier.name.toLowerCase())
    }));

    // Ordenar por score descendente
    scored.sort((a, b) => b.score - a.score);

    return {
      suppliers: scored.map(s => ({
        ...s,
        confidence: s.score
      })),
      total: scored.length
    };
  }

  /**
   * Calcula score de similitud entre dos strings
   * @param search - Texto de búsqueda
   * @param target - Texto objetivo
   * @returns Score entre 0 y 1
   */
  private calculateSimilarityScore(search: string, target: string): number {
    if (search === target) return 1.0;

    // Coincidencia exacta parcial
    if (target.includes(search)) {
      return search.length / target.length;
    }

    // Damerau-Levenshtein distance para similitud aproximada
    const distance = this.damerauLevenshtein(search, target);
    const maxLength = Math.max(search.length, target.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Algoritmo de distancia Damerau-Levenshtein
   */
  private damerauLevenshtein(a: string, b: string): number {
    const matrix = Array(a.length + 1).fill(null).map(() =>
      Array(b.length + 1).fill(null)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );

        // Transposition
        if (i > 1 && j > 1 &&
            a[i - 1] === b[j - 2] &&
            a[i - 2] === b[j - 1]) {
          matrix[i][j] = Math.min(
            matrix[i][j],
            matrix[i - 2][j - 2] + cost
          );
        }
      }
    }

    return matrix[a.length][b.length];
  }

  /**
   * Obtiene historial de precios de proveedor
   * @param supplierId - ID del proveedor
   * @param productId - ID del producto (opcional)
   * @returns Historial de precios
   */
  async getPriceHistory(supplierId: string, productId?: string) {
    const where: any = { supplierId };
    if (productId) {
      where.productId = productId;
    }

    const history = await this.prisma.supplierPriceHistory.findMany({
      where,
      orderBy: { validFrom: 'desc' },
      take: 50,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            referenceCode: true
          }
        }
      }
    });

    return history;
  }
}
```

### 3. Business Rules Validation

**File:** `backend/ocr-microservice/app/services/validation_service.py`

```python
from typing import Dict, List, Optional
import httpx
from dataclasses import dataclass

@dataclass
class ValidationResult:
    """Resultado de validación de proveedor"""
    is_valid: bool
    supplier_id: Optional[str]
    supplier_name: Optional[str]
    confidence: float
    validation_errors: List[str]
    warnings: List[str]
    enrichment: Dict

class SupplierBusinessRules:
    """Reglas de negocio para validación de proveedores"""

    def __init__(self, backend_url: str):
        self.backend_url = backend_url
        self.cache = {}
        self.cache_ttl = 3600

    async def validate_supplier(
        self,
        supplier_name: Optional[str],
        cif: Optional[str],
        nif: Optional[str]
    ) -> ValidationResult:
        """
        Valida proveedor usando reglas de negocio y base de datos

        Returns:
            ValidationResult con información detallada
        """
        result = ValidationResult(
            is_valid=False,
            supplier_id=None,
            supplier_name=None,
            confidence=0.0,
            validation_errors=[],
            warnings=[],
            enrichment={}
        )

        # Rule 1: CIF validation (highest priority)
        if cif:
            validation_result = await self._validate_by_cif(cif)
            if validation_result.get("valid"):
                result.is_valid = True
                result.supplier_id = validation_result["supplier_id"]
                result.supplier_name = validation_result["supplier_name"]
                result.confidence = validation_result["confidence"]
                result.enrichment.update({
                    "taxRate": validation_result.get("taxRate"),
                    "paymentTerms": validation_result.get("paymentTerms")
                })
                result.validation_errors.append("✅ Validación por CIF exitosa")
            else:
                result.validation_errors.append(
                    f"⚠️ CIF no encontrado o inválido: {cif}"
                )

        # Rule 2: Name-based validation (if CIF failed or missing)
        if not result.is_valid and supplier_name:
            search_result = await self._search_by_name(supplier_name)
            if search_result.get("suppliers"):
                best_match = search_result["suppliers"][0]
                if best_match["confidence"] >= 0.70:
                    result.is_valid = True
                    result.supplier_id = best_match["id"]
                    result.supplier_name = best_match["name"]
                    result.confidence = best_match["confidence"]
                    result.validation_errors.append(
                        f"✅ Match por nombre: {best_match['name']}"
                    )
                else:
                    result.warnings.append(
                        f"⚠️ Coincidencia débil: {best_match['name']} ({best_match['confidence']:.0%})"
                    )
            else:
                result.validation_errors.append(
                    f"❌ No se encontró proveedor: {supplier_name}"
                )

        # Rule 3: Price history validation
        if result.is_valid:
            await self._validate_price_history(result)

        # Rule 4: Required fields
        if not supplier_name:
            result.validation_errors.append("❌ Nombre de proveedor requerido")

        return result

    async def _validate_by_cif(self, cif: str) -> Optional[Dict]:
        """Valida CIF contra backend"""
        cache_key = f"cif:{cif}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.backend_url}/api/v1/suppliers/validate-cif",
                    json={"cif": cif},
                    timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    self.cache[cache_key] = data
                    return data
        except Exception as e:
            print(f"Error validating CIF: {e}")

        return None

    async def _search_by_name(self, name: str, limit: int = 5) -> Optional[Dict]:
        """Busca proveedor por nombre"""
        cache_key = f"name:{name.lower()}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.backend_url}/api/v1/suppliers/search",
                    params={"name": name, "limit": limit},
                    timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    self.cache[cache_key] = data
                    return data
        except Exception as e:
            print(f"Error searching supplier: {e}")

        return None

    async def _validate_price_history(self, result: ValidationResult):
        """Valida historial de precios del proveedor"""
        if not result.supplier_id:
            return

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.backend_url}/api/v1/suppliers/{result.supplier_id}/price-history",
                    timeout=5.0
                )
                if response.status_code == 200:
                    history = response.json()
                    if history:
                        result.enrichment["priceHistoryAvailable"] = True
                        result.enrichment["priceHistoryCount"] = len(history)
                        result.validation_errors.append(
                            f"✅ {len(history)} registros de precios históricos"
                        )
        except Exception as e:
            result.warnings.append(f"⚠️ No se pudo obtener historial: {e}")
```

## Caching Strategy

### Redis Cache Configuration

**File:** `backend/src/modules/suppliers/suppliers.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class SuppliersService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prisma: PrismaService
  ) {}

  private readonly CACHE_TTL = 3600; // 1 hora

  async getCachedSupplier(cif: string) {
    const cacheKey = `supplier:cif:${cif}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return { ...cached, fromCache: true };
    }

    const supplier = await this.validateByCif(cif);
    if (supplier.valid) {
      await this.cacheManager.set(cacheKey, supplier, this.CACHE_TTL);
    }

    return { ...supplier, fromCache: false };
  }
}
```

### Cache Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Cache Hit Rate | ≥60% | TBD | 🔄 TBD |
| Cache TTL | 1h | 1h | ✅ |
| Cache Size | <100MB | TBD | 🔄 TBD |
| Eviction Rate | <5%/h | TBD | 🔄 TBD |

## Testing

### Integration Tests

**File:** `backend/test/integration/supplier-validation.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('Supplier Validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/api/v1/suppliers/validate-cif', () => {
    it('should validate existing supplier by CIF', () => {
      return request(app.getHttpServer())
        .post('/api/v1/suppliers/validate-cif')
        .send({ cif: 'B12345678' })
        .expect(200)
        .expect(res => {
          expect(res.body.valid).toBe(true);
          expect(res.body.confidence).toBeGreaterThan(0.9);
        });
    });

    it('should return invalid for non-existent CIF', () => {
      return request(app.getHttpServer())
        .post('/api/v1/suppliers/validate-cif')
        .send({ cif: 'B00000000' })
        .expect(200)
        .expect(res => {
          expect(res.body.valid).toBe(false);
          expect(res.body.confidence).toBe(0);
        });
    });
  });

  describe('/api/v1/suppliers/search', () => {
    it('should find supplier by name', () => {
      return request(app.getHttpServer())
        .get('/api/v1/suppliers/search')
        .query({ name: 'Proveedor' })
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body.suppliers)).toBe(true);
        });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## Performance Optimization

### 1. Database Indexes

```sql
-- Índices compuestos para búsquedas frecuentes
CREATE INDEX idx_suppliers_cif_status ON "Supplier"("cif", "status");
CREATE INDEX idx_suppliers_name_status ON "Supplier"("name", "status");
CREATE INDEX idx_price_history_supplier_product ON "SupplierPriceHistory"("supplierId", "productId");

-- Índice para búsqueda por texto (opcional, requiere PostgreSQL extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_suppliers_name_trgm ON "Supplier" USING gin("name" gin_trgm_ops);
```

### 2. Connection Pooling

**File:** `backend/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pooling
  directUrl = env("DIRECT_URL") // For migrations
}

// In NestJS
database {
  pool_timeout = 20
  connection_limit = 20
}
```

## Monitoring

### Metrics to Track

- Supplier validation success rate
- Cache hit/miss ratio
- DB query latency
- Validation errors by type

### Alerts

- Cache hit rate < 40%
- Validation errors > 10%
- DB query latency > 100ms

---

**Status:** 🔄 In Development
**Phase:** 260619-ocr-enhancement - Phase 03
**Dependencies:** Phase 02 (CIF/NIF Recognition)
**Last Updated:** June 19, 2026
**Version:** 1.0.0