-- CreateEnum
CREATE TYPE "CuinerMode" AS ENUM ('DRY_RUN', 'LIVE');

-- CreateEnum
CREATE TYPE "CuinerExportStatus" AS ENUM ('PENDIENTE', 'SIMULADO', 'ENVIADO', 'ERROR');

-- CreateEnum
CREATE TYPE "CuinerSaleStatus" AS ENUM ('PENDIENTE', 'APLICADA', 'SIN_MAPEO', 'IGNORADA');

-- CreateTable
CREATE TABLE "cuiner_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "CuinerMode" NOT NULL DEFAULT 'DRY_RUN',
    "empresa" TEXT NOT NULL DEFAULT '01',
    "centro" TEXT NOT NULL,
    "almacen" TEXT NOT NULL DEFAULT '01',
    "actUsuario" TEXT,
    "warehouseId" TEXT,
    "connectorTokenHash" TEXT,
    "lastVentasCabId" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "razon" TEXT,
    "cif" TEXT,
    "baja" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_articles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "manipulacion" TEXT,
    "medida" DOUBLE PRECISION,
    "baja" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_article_suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "articulo" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "refProveedor" TEXT,
    "ultFecha" TIMESTAMP(3),
    "ultImporte" DOUBLE PRECISION,
    "ultIva" DOUBLE PRECISION,
    "ultUnPorCaja" DOUBLE PRECISION,
    "ultImporteUC" BOOLEAN,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_article_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_dishes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_supplier_maps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_supplier_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_product_maps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "articulo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_product_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_dish_maps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "recipeId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_dish_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_albaran_exports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "albaranId" TEXT NOT NULL,
    "status" "CuinerExportStatus" NOT NULL DEFAULT 'PENDIENTE',
    "payload" JSONB NOT NULL,
    "cuinerIdDocsCab" INTEGER,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuiner_albaran_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuiner_sale_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idVentasCab" INTEGER NOT NULL,
    "linea" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "unidades" DOUBLE PRECISION NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "status" "CuinerSaleStatus" NOT NULL DEFAULT 'PENDIENTE',
    "stockMovementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuiner_sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_configs_tenantId_key" ON "cuiner_configs"("tenantId");

-- CreateIndex
CREATE INDEX "cuiner_configs_connectorTokenHash_idx" ON "cuiner_configs"("connectorTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_suppliers_tenantId_codigo_key" ON "cuiner_suppliers"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_articles_tenantId_codigo_key" ON "cuiner_articles"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "cuiner_article_suppliers_tenantId_proveedor_idx" ON "cuiner_article_suppliers"("tenantId", "proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_article_suppliers_tenantId_articulo_proveedor_key" ON "cuiner_article_suppliers"("tenantId", "articulo", "proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_dishes_tenantId_tipo_producto_key" ON "cuiner_dishes"("tenantId", "tipo", "producto");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_supplier_maps_tenantId_supplierId_key" ON "cuiner_supplier_maps"("tenantId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_supplier_maps_tenantId_codigo_key" ON "cuiner_supplier_maps"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "cuiner_product_maps_tenantId_articulo_idx" ON "cuiner_product_maps"("tenantId", "articulo");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_product_maps_tenantId_productId_key" ON "cuiner_product_maps"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_dish_maps_tenantId_tipo_producto_key" ON "cuiner_dish_maps"("tenantId", "tipo", "producto");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_albaran_exports_albaranId_key" ON "cuiner_albaran_exports"("albaranId");

-- CreateIndex
CREATE INDEX "cuiner_albaran_exports_tenantId_status_idx" ON "cuiner_albaran_exports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cuiner_sale_lines_tenantId_status_idx" ON "cuiner_sale_lines"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cuiner_sale_lines_tenantId_idVentasCab_linea_key" ON "cuiner_sale_lines"("tenantId", "idVentasCab", "linea");

