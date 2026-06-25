"""
Servicio de consulta a base de datos de proveedores para validación OCR

Propósito: Conectar a PostgreSQL y validar proveedores con aislamiento multi-tenant
"""
import logging
import asyncio
from typing import Optional, List, Dict
from dataclasses import dataclass
import asyncpg
from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class SupplierMatch:
    """Resultado de match de proveedor"""
    supplier_id: str
    supplier_name: str
    confidence: float
    matched_by: str  # 'exact', 'fuzzy', 'name'


class SupplierDbService:
    """Servicio de búsqueda de proveedores en base de datos PostgreSQL"""

    def __init__(self, db_url: Optional[str] = None):
        """
        Inicializar servicio de base de datos

        Args:
            db_url: URL de conexión PostgreSQL (opcional, usa settings si None)
        """
        self.db_url = db_url or getattr(settings, 'database_url',
                                           'postgresql://localhost:5432/chefchek')
        self.pool: Optional[asyncpg.Pool] = None
        self._initialized = False
        logger.info(f"SupplierDbService inicializado con DB URL: {self.db_url[:20]}...")

    async def initialize_pool(self):
        """Inicializar pool de conexiones"""
        if self._initialized:
            return

        try:
            self.pool = await asyncpg.create_pool(
                self.db_url,
                min_size=1,
                max_size=10,
                timeout=5.0
            )
            self._initialized = True
            logger.info("Pool de conexiones PostgreSQL inicializado")
        except Exception as e:
            logger.error(f"Error inicializando pool: {e}")
            raise

    async def close_pool(self):
        """Cerrar pool de conexiones"""
        if self.pool:
            await self.pool.close()
            self._initialized = False
            logger.info("Pool de conexiones PostgreSQL cerrado")

    async def get_supplier_by_name(
        self,
        tenant_id: str,
        name: str
    ) -> Optional[SupplierMatch]:
        """
        Buscar proveedor por nombre exacto

        Args:
            tenant_id: ID del tenant para aislamiento
            name: Nombre del proveedor

        Returns:
            SupplierMatch si encontrado, None en caso contrario
        """
        if not self._initialized:
            await self.initialize_pool()

        try:
            async with self.pool.acquire() as conn:
                query = """
                    SELECT id, name, "isActive"
                    FROM "Supplier"
                    WHERE "tenantId" = $1
                    AND LOWER(name) = LOWER($2)
                    AND "isActive" = true
                    LIMIT 1
                """
                row = await conn.fetchrow(query, tenant_id, name.lower())

                if row:
                    return SupplierMatch(
                        supplier_id=row['id'],
                        supplier_name=row['name'],
                        confidence=0.95,
                        matched_by='exact'
                    )
                return None

        except Exception as e:
            logger.error(f"Error buscando proveedor por nombre: {e}")
            return None

    async def fuzzy_match_suppliers(
        self,
        tenant_id: str,
        name: str,
        threshold: float = 0.7,
        limit: int = 5
    ) -> List[SupplierMatch]:
        """
        Buscar proveedor por nombre aproximado (fuzzy matching)

        Args:
            tenant_id: ID del tenant para aislamiento
            name: Nombre del proveedor
            threshold: Umbral de similitud (0-1)
            limit: Número máximo de resultados

        Returns:
            Lista de SupplierMatch ordenados por similitud
        """
        if not self._initialized:
            await self.initialize_pool()

        try:
            async with self.pool.acquire() as conn:
                # Usar LIKE para coincidencia parcial de nombre
                # PostgreSQL tiene soporte nativo para LIKE case-insensitive con LOWER()
                query = """
                    SELECT id, name, "isActive"
                    FROM "Supplier"
                    WHERE "tenantId" = $1
                    AND (LOWER(name) LIKE LOWER($2)
                         OR $2 LIKE '%' || LOWER(name) || '%')
                    AND "isActive" = true
                    LIMIT $3
                """
                rows = await conn.fetch(
                    query,
                    tenant_id,
                    f'%{name.lower()}%',
                    limit
                )

                matches = []
                for row in rows:
                    # Calcular score de similitud simple
                    supplier_name_lower = row['name'].lower()
                    query_lower = name.lower()

                    # Coincidencia exacta parcial
                    if query_lower in supplier_name_lower or supplier_name_lower in query_lower:
                        similarity = len(set(query_lower) & set(supplier_name_lower)) / max(len(set(query_lower)), 1)
                    else:
                        similarity = 0.5  # Coincidencia débil por LIKE

                    if similarity >= threshold:
                        matches.append(SupplierMatch(
                            supplier_id=row['id'],
                            supplier_name=row['name'],
                            confidence=similarity,
                            matched_by='fuzzy'
                        ))

                # Ordenar por confianza descendente
                matches.sort(key=lambda m: m.confidence, reverse=True)
                return matches

        except Exception as e:
            logger.error(f"Error en fuzzy match de proveedores: {e}")
            return []

    async def match_supplier(
        self,
        tenant_id: str,
        name: Optional[str] = None,
        cif: Optional[str] = None
    ) -> Optional[SupplierMatch]:
        """
        Encuentra mejor match usando nombre y/o CIF

        Args:
            tenant_id: ID del tenant para aislamiento
            name: Nombre del proveedor (opcional)
            cif: CIF del proveedor (opcional)

        Returns:
            SupplierMatch con mejor confianza, None si no hay match
        """
        # Nota: La tabla Supplier actualmente no tiene columna CIF
        # Solo match por nombre por ahora

        if not name:
            return None

        # Prioridad: Exact match > Fuzzy match
        exact_match = await self.get_supplier_by_name(tenant_id, name)
        if exact_match:
            return exact_match

        # Fallback: Fuzzy match
        fuzzy_matches = await self.fuzzy_match_suppliers(tenant_id, name, threshold=0.7)
        if fuzzy_matches:
            return fuzzy_matches[0]

        return None

    def is_initialized(self) -> bool:
        """
        Verificar si el servicio está inicializado

        Returns:
            True si el pool está inicializado
        """
        return self._initialized


# Instancia global (lazy initialization)
_supplier_db_service: Optional[SupplierDbService] = None


def get_supplier_db_service() -> SupplierDbService:
    """
    Obtiene la instancia global del servicio de base de datos

    Returns:
        SupplierDbService inicializado
    """
    global _supplier_db_service
    if _supplier_db_service is None:
        _supplier_db_service = SupplierDbService()
    return _supplier_db_service