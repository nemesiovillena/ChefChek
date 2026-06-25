# CIF/NIF Recognition Guide - ChefChek OCR

## Overview

Sistema de reconocimiento y validación automática de identificadores fiscales españoles (CIF/NIF) integrado en el pipeline de OCR para procesamiento de albaranes y facturas de proveedores.

## Architecture

```
┌─────────────────┐
│  OCR Document   │ ← Texto extraído del documento
└────────┬────────┘
         │
┌────────▼─────────┐
│  Pattern Engine  │ ← Regex para CIF/NIF
│  (Regex Match)   │
└────────┬────────┘
         │
┌────────▼─────────┐
│  Validation      │ ← Checksum algoritmo
│  (Checksum)      │
└────────┬────────┘
         │
┌────────▼─────────┐
│  Supplier DB     │ ← PostgreSQL lookup
│  Lookup          │
└────────┬────────┘
         │
┌────────▼─────────┐
│  Supplier Match  │ ← Confidence scoring
│  & Enrichment    │
└─────────────────┘
```

## Format Specifications

### CIF (Código de Identificación Fiscal)

**Formato:** `[A-Z]\d{7}[0-9A-Z]`

**Ejemplos:**
- `B12345678` - Sociedad anónima
- `G98765432` - Asociación
- `A12345671` - Sociedad limitada

**Estructura:**
- **Posición 1:** Tipo de entidad (A/B/C/D/E/F/G/H/J/N/P/Q/R/S/U/V/W)
- **Posiciones 2-8:** Número de registro (7 dígitos)
- **Posición 9:** Dígito de control (numérico o letra)

### NIF (Número de Identificación Fiscal)

**Formato:** `[0-9]{8}[A-Z]` o `[XYZ]\d{7}[A-Z]`

**Ejemplos:**
- `12345678A` - Persona física
- `X1234567A` - NIE extranjero (X)
- `Y1234567A` - NIE extranjero (Y)
- `Z1234567A` - NIE extranjero (Z)

## Implementation

### 1. Pattern Matching

**File:** `backend/ocr-microservice/app/services/cif_validator.py`

```python
import re
from typing import Optional, Tuple

class CIFNIFValidator:
    """Validador de CIF/NIF españoles"""

    # CIF pattern: Letra + 7 dígitos + dígito de control
    CIF_PATTERN = re.compile(r'[A-Z]\d{7}[0-9A-Z]')

    # NIF pattern: 8 dígitos + letra O X/Y/Z + 7 dígitos + letra
    NIF_PATTERN = re.compile(r'(?:[0-9]{8}[A-Z]|[XYZ]\d{7}[A-Z])')

    # Letras tipo entidad CIF
    CIF_ENTITY_TYPES = {
        'A': 'Sociedad Anónima',
        'B': 'Sociedad Limitada',
        'C': 'Sociedad Colectiva',
        'D': 'Comunidad de Bienes',
        'E': 'Comunidad de Propietarios',
        'F': 'Cooperativa',
        'G': 'Asociación',
        'H': 'Instituciones de Inversión Colectiva',
        'J': 'Sociedades Civiles',
        'N': 'Entidad Extranjera',
        'P': 'Corporación Local',
        'Q': 'Organismo Público',
        'R': 'Congregación Religiosa',
        'S': 'Órgano de la Administración',
        'U': 'Unión Temporal de Empresas',
        'V': 'Fondo de Pensiones',
        'W': 'Entidad de Garantía de Depósitos'
    }

    def extract_from_text(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extrae CIF y NIF del texto OCR

        Returns:
            (cif_match, nif_match) - Tupla con matches encontrados
        """
        cif_match = self.CIF_PATTERN.search(text)
        nif_match = self.NIF_PATTERN.search(text)

        return (
            cif_match.group() if cif_match else None,
            nif_match.group() if nif_match else None
        )

    def validate_cif(self, cif: str) -> bool:
        """
        Valida CIF usando algoritmo de verificación

        Args:
            cif: CIF a validar

        Returns:
            True si CIF es válido, False en caso contrario
        """
        if len(cif) != 9:
            return False

        entity_letter = cif[0]
        num_part = cif[1:8]
        control_char = cif[8]

        # Sumar posiciones pares
        sum_even = sum(int(num_part[i]) for i in range(1, 7, 2))

        # Multiplicar y sumar posiciones impares
        odd_values = [int(num_part[i]) * 2 for i in range(0, 7, 2)]
        sum_odd = 0
        for val in odd_values:
            sum_odd += val // 10 + val % 10

        total = sum_even + sum_odd
        calculated_control = (10 - (total % 10)) % 10

        # Para entidades Q/S, el dígito de control es letra
        if entity_letter in ['Q', 'S']:
            control_letters = 'JABCDEFGHI'
            return control_char == control_letters[calculated_control]

        # Para otras entidades, el dígito de control es número
        return int(control_char) == calculated_control

    def validate_nif(self, nif: str) -> bool:
        """
        Valida NIF/NIE usando algoritmo de verificación

        Args:
            nif: NIF a validar

        Returns:
            True si NIF es válido, False en caso contrario
        """
        if len(nif) != 9:
            return False

        # Reemplazar X/Y/Z por 0/1/2 para NIE
        first_char = nif[0]
        if first_char in ['X', 'Y', 'Z']:
            replacement = {'X': '0', 'Y': '1', 'Z': '2'}
            first_char = replacement[first_char]

        num_part = first_char + nif[1:8]
        control_letter = nif[8]

        # Calcular dígito de control
        num = int(num_part)
        remainder = num % 23
        control_letters = 'TRWAGMYFPDXBNJZSQVHLCKE'

        return control_letter == control_letters[remainder]
```

### 2. Supplier Database Integration

**File:** `backend/ocr-microservice/app/services/supplier_lookup.py`

```python
import asyncio
from typing import Optional
import httpx
from dataclasses import dataclass

@dataclass
class SupplierMatch:
    """Resultado de match de proveedor"""
    supplier_id: str
    supplier_name: str
    cif: Optional[str]
    confidence: float
    matched_by: str  # 'cif' | 'name' | 'both'

class SupplierLookupService:
    """Servicio de búsqueda de proveedores en base de datos"""

    def __init__(self, backend_url: str):
        self.backend_url = backend_url
        self.cache = {}  # Simple cache TTL 1h
        self.cache_ttl = 3600

    async def find_by_cif(self, cif: str) -> Optional[SupplierMatch]:
        """
        Busca proveedor por CIF

        Args:
            cif: CIF del proveedor

        Returns:
            SupplierMatch si encontrado, None en caso contrario
        """
        # Check cache
        cache_key = f"cif:{cif}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.backend_url}/api/v1/suppliers/validate-cif",
                json={"cif": cif},
                timeout=5.0
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("valid"):
                    match = SupplierMatch(
                        supplier_id=data["supplier_id"],
                        supplier_name=data["supplier_name"],
                        cif=cif,
                        confidence=0.95,  # Alta confianza por CIF exacto
                        matched_by="cif"
                    )
                    self.cache[cache_key] = match
                    return match

        return None

    async def find_by_name(self, name: str) -> Optional[SupplierMatch]:
        """
        Busca proveedor por nombre aproximado

        Args:
            name: Nombre del proveedor

        Returns:
            SupplierMatch si encontrado, None en caso contrario
        """
        # Check cache
        cache_key = f"name:{name.lower()}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.backend_url}/api/v1/suppliers/search",
                params={"name": name},
                timeout=5.0
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("suppliers"):
                    supplier = data["suppliers"][0]  # Tomar mejor match
                    match = SupplierMatch(
                        supplier_id=supplier["id"],
                        supplier_name=supplier["name"],
                        cif=supplier.get("cif"),
                        confidence=0.75,  # Confianza media por nombre
                        matched_by="name"
                    )
                    self.cache[cache_key] = match
                    return match

        return None

    async def find_best_match(
        self,
        cif: Optional[str],
        name: Optional[str]
    ) -> Optional[SupplierMatch]:
        """
        Encuentra mejor match usando CIF y/o nombre

        Args:
            cif: CIF del proveedor (opcional)
            name: Nombre del proveedor (opcional)

        Returns:
            SupplierMatch con mejor confianza, None si no hay match
        """
        # Prioridad: CIF > Nombre > Ambos
        if cif:
            match = await self.find_by_cif(cif)
            if match and match.confidence >= 0.80:
                return match

        if name:
            match = await self.find_by_name(name)
            if match and match.confidence >= 0.70:
                return match

        # Si ambos disponibles, intentar match combinado
        if cif and name:
            cif_match = await self.find_by_cif(cif)
            if cif_match:
                # Validar que nombre coincida parcialmente
                if name.lower() in cif_match.supplier_name.lower():
                    return SupplierMatch(
                        supplier_id=cif_match.supplier_id,
                        supplier_name=cif_match.supplier_name,
                        cif=cif,
                        confidence=0.98,  # Máxima confianza
                        matched_by="both"
                    )

        return None
```

### 3. Integration with Document Processor

**File:** `backend/ocr-microservice/app/services/document_processor.py`

```python
from .cif_validator import CIFNIFValidator
from .supplier_lookup import SupplierLookupService

class DocumentProcessor:
    def __init__(self, backend_url: str):
        self.cif_validator = CIFNIFValidator()
        self.supplier_lookup = SupplierLookupService(backend_url)

    async def extract_supplier_info(self, text: str) -> dict:
        """
        Extrae y valida información del proveedor

        Args:
            text: Texto extraído por OCR

        Returns:
            Dict con información del proveedor
        """
        result = {
            "supplier_name": None,
            "cif": None,
            "nif": None,
            "supplier_id": None,
            "confidence": 0.0,
            "validation_errors": []
        }

        # Extraer CIF/NIF del texto
        cif_match, nif_match = self.cif_validator.extract_from_text(text)

        # Validar CIF si encontrado
        if cif_match:
            if self.cif_validator.validate_cif(cif_match):
                result["cif"] = cif_match
                result["validation_errors"].append(f"✅ CIF válido: {cif_match}")
            else:
                result["validation_errors"].append(f"⚠️ CIF inválido: {cif_match}")

        # Validar NIF si encontrado
        if nif_match:
            if self.cif_validator.validate_nif(nif_match):
                result["nif"] = nif_match
                result["validation_errors"].append(f"✅ NIF válido: {nif_match}")
            else:
                result["validation_errors"].append(f"⚠️ NIF inválido: {nif_match}")

        # Buscar en base de datos
        if result["cif"]:
            match = await self.supplier_lookup.find_by_cif(result["cif"])
            if match:
                result["supplier_id"] = match.supplier_id
                result["supplier_name"] = match.supplier_name
                result["confidence"] = match.confidence
                result["validation_errors"].append(
                    f"✅ Proveedor encontrado: {match.supplier_name}"
                )

        return result
```

## API Endpoints

### Backend NestJS

#### Validate CIF
```bash
POST /api/v1/suppliers/validate-cif
Content-Type: application/json

{
  "cif": "B12345678"
}

Response:
{
  "valid": true,
  "supplier_id": "550e8400-e29b-41d4-a716-446655440000",
  "supplier_name": "Proveedor Ejemplo S.L.",
  "matched": true
}
```

#### Search Supplier by Name
```bash
GET /api/v1/suppliers/search?name=proveedor+ejemplo

Response:
{
  "suppliers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Proveedor Ejemplo S.L.",
      "cif": "B12345678",
      "score": 0.95
    }
  ]
}
```

## Testing

### Unit Tests

**File:** `backend/ocr-microservice/tests/test_cif_validator.py`

```python
import pytest
from app.services.cif_validator import CIFNIFValidator

@pytest.fixture
def validator():
    return CIFNIFValidator()

class TestCIFValidation:
    def test_valid_cif_company(self, validator):
        assert validator.validate_cif("B12345678") == True

    def test_invalid_cif_checksum(self, validator):
        assert validator.validate_cif("B12345670") == False

    def test_cif_wrong_length(self, validator):
        assert validator.validate_cif("B123456") == False

class TestNIFValidation:
    def test_valid_nif(self, validator):
        assert validator.validate_nif("12345678A") == True

    def test_valid_nie_x(self, validator):
        assert validator.validate_nif("X1234567A") == True

    def test_invalid_nif_checksum(self, validator):
        assert validator.validate_nif("12345670A") == False

class TestExtraction:
    def test_extract_cif_from_text(self, validator):
        text = "Proveedor: B12345678"
        cif, nif = validator.extract_from_text(text)
        assert cif == "B12345678"

    def test_extract_both_from_text(self, validator):
        text = "CIF: B12345678, NIF: 12345678A"
        cif, nif = validator.extract_from_text(text)
        assert cif == "B12345678"
        assert nif == "12345678A"
```

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| CIF Extraction Accuracy | ≥95% | 🔄 TBD |
| NIF Extraction Accuracy | ≥95% | 🔄 TBD |
| CIF Validation Speed | <10ms | 🔄 TBD |
| Supplier DB Lookup | <50ms | 🔄 TBD |
| Cache Hit Rate | ≥60% | 🔄 TBD |
| Overall Match Accuracy | ≥80% | 🔄 TBD |

## Troubleshooting

### CIF Not Detected
- Verificar calidad de imagen OCR
- Revisar logs de extracción de texto
- Ajustar patrones regex si formato es diferente

### Invalid CIF Checksum
- Verificar que OCR no confundió dígitos (0/O, 1/I/l)
- Considerar corrección heurística de errores comunes

### Supplier Not Found in DB
- Verificar que proveedor existe en PostgreSQL
- Revisar formato de CIF en DB (sin guiones ni espacios)
- Considerar match por nombre si CIF falla

### Cache Issues
- Verificar TTL de cache (3600s por defecto)
- Limpiar cache si proveedor se actualizó recientemente

---

**Status:** 🔄 In Development
**Phase:** 260619-ocr-enhancement - Phase 02
**Last Updated:** June 19, 2026
**Version:** 1.0.0