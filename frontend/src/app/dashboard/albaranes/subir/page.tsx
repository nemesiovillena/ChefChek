'use client';

import { Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  Camera,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Sparkles,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { formatEuro } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAlbaranUpload, AlbaranUploadResult } from '@/hooks/use-albaran-upload';
import { useOcrConfig } from '@/hooks/use-ocr-config';
import { usePurchaseOrder } from '@/hooks/use-purchase-orders';
import { OCR_MODELS, getApiKeyForModel, getOcrModel } from '@/lib/ai-api-keys';

export const dynamic = 'force-dynamic';

/** Results may include an albaranId when the backend created an albaran record. */
type ResultsWithAlbaran = AlbaranUploadResult & { albaranId?: string };

function getAlbaranId(results: AlbaranUploadResult): string | undefined {
  return (results as ResultsWithAlbaran).albaranId;
}

export default function SubirAlbaranPage() {
  return (
    <Suspense fallback={null}>
      <SubirAlbaranContent />
    </Suspense>
  );
}

function SubirAlbaranContent() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const purchaseOrderId = searchParams.get('purchaseOrderId') || undefined;
  const { data: linkedOrder } = usePurchaseOrder(purchaseOrderId ?? null);

  // Motor de extracción: la config vive en el servidor (por tenant, compartida
  // entre dispositivos). El backend resuelve modelo+key al subir aunque este
  // dispositivo no los tenga; aquí se leen solo para mostrar el modelo activo y,
  // si la key está en este navegador, enviarla (backward compat).
  const { data: ocrConfig } = useOcrConfig();
  const serverModel = ocrConfig?.model && ocrConfig.model !== 'regex' ? ocrConfig.model : null;
  const localModel = getOcrModel();
  const aiModel = serverModel ?? (localModel && localModel !== 'regex' ? localModel : 'regex');
  const aiApiKey = aiModel !== 'regex' ? getApiKeyForModel(aiModel) : '';

  const {
    fileInputRef,
    files,
    isUploading,
    uploadProgress,
    results,
    error,
    handleFileSelect,
    removeFile,
    processFiles,
    reset,
  } = useAlbaranUpload({
    aiModel: aiModel !== 'regex' ? aiModel : undefined,
    aiApiKey: aiModel !== 'regex' ? aiApiKey : undefined,
    purchaseOrderId,
  });

  const selectedModelInfo = OCR_MODELS.find((m) => m.id === aiModel);
  const needsApiKey = aiModel && aiModel !== 'regex';
  const backHref = purchaseOrderId
    ? `/dashboard/compras/pedidos/${purchaseOrderId}`
    : '/dashboard/albaranes';

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl pb-12">
      {/* Back + title */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        {purchaseOrderId ? 'Volver al pedido' : 'Volver a Albaranes'}
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Subir Albarán</h1>
        <p className="text-muted-foreground mt-1">
          {linkedOrder
            ? `Se vinculará al pedido ${linkedOrder.orderNumber}. Haz una foto o sube un archivo para extraer los productos.`
            : 'Haz una foto al albarán o sube un archivo para extraer los productos automáticamente'}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5">
          {/* Motor de extracción — elegido en /dashboard/settings, solo lectura aquí */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Motor de extracción: {selectedModelInfo?.name || 'Solo OCR (gratis)'}
                </span>
              </div>
              <Link
                href="/dashboard/settings"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0"
              >
                <Settings className="h-3 w-3" />
                Cambiar
              </Link>
            </div>

            {/* API Key status — enlace a settings si no hay key */}
            {needsApiKey && (
              <div>
                {aiApiKey ? (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    API Key configurada
                  </p>
                ) : (
                  <Link
                    href="/dashboard/settings"
                    className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    <Settings className="h-3 w-3" />
                    Configura la API Key en Ajustes
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Capture / Upload Area — mobile-first: cámara prioritaria */}
          <div className="space-y-3">
            {/* Acción principal en móvil: abrir la cámara */}
            <Button
              type="button"
              className="w-full h-14 text-base"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-2 h-5 w-5" />
              Hacer foto al albarán
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="sr-only"
            />

            {/* Acción secundaria: galería / PDF (escritorio y varios archivos) */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir imagen o PDF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="sr-only"
            />
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG, HEIC, PDF — máx 10MB por archivo
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Archivos seleccionados</h3>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {results ? 'Importando productos...' : 'Procesando documento...'}
                </span>
                {needsApiKey && !results && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="mr-1 h-3 w-3" />
                    {selectedModelInfo?.name}
                  </Badge>
                )}
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Process Button */}
          {!isUploading && files.length > 0 && !results && (
            <Button className="w-full h-12" onClick={processFiles}>
              <Upload className="mr-2 h-4 w-4" />
              Procesar Albarán
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card className="mt-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Productos Detectados</CardTitle>
              <Badge variant="default">{results.products.length} productos</Badge>
            </div>
            <CardDescription>
              {results.products.length} producto{results.products.length !== 1 ? 's' : ''} detectados
              con {results.products.filter((p) => p.confidence >= 0.7).length} de alta confianza
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.products.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium">{product.name}</h4>
                    {product.matchedProductId ? (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Coincide
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Nuevo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span>
                      {product.quantity} {product.unit}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground">
                      {formatEuro(product.unit_price)}
                    </span>
                    <span>•</span>
                    <span
                      className={
                        product.confidence >= 0.7
                          ? 'text-green-600'
                          : product.confidence >= 0.5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }
                    >
                      {(product.confidence * 100).toFixed(0)}% confianza
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Los productos se crean/actualizan al CONFIRMAR el albarán
                (albaran-stock.service): la revisión de líneas es el paso previo */}
            <div className="pt-4 border-t flex flex-col sm:flex-row gap-2">
              <Link
                href={
                  getAlbaranId(results)
                    ? `/dashboard/albaranes/${getAlbaranId(results)}`
                    : '/dashboard/albaranes'
                }
                className="flex-1"
              >
                <Button className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {getAlbaranId(results) ? 'Revisar Albarán' : 'Ver en Albaranes'}
                </Button>
              </Link>
              <Button variant="ghost" onClick={reset}>
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
