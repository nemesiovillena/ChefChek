'use client';

import { useState, useRef } from 'react';
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
import { getApiKeyForModel } from '@/lib/ai-api-keys';

export const dynamic = 'force-dynamic';

/** Modelos IA disponibles con info de coste */
const AI_MODELS = [
  { id: 'regex', name: 'Solo OCR (gratis)', cost: '0 €', desc: 'Regex básico, sin coste' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', cost: '~0,01 €', desc: 'Rápido y barato, buena precisión' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', cost: '~0,005 €', desc: 'El más barato, muy buena visión' },
  { id: 'gpt-4o', name: 'GPT-4o', cost: '~0,05 €', desc: 'Máxima precisión, más caro' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', cost: '~0,01 €', desc: 'Buen balance calidad/precio' },
  { id: 'openrouter-gpt-4o-mini', name: 'OR: GPT-4o Mini', cost: '~0,01 €', desc: 'OpenRouter — GPT-4o Mini' },
  { id: 'openrouter-claude-haiku', name: 'OR: Claude Haiku', cost: '~0,01 €', desc: 'OpenRouter — Claude Haiku' },
  { id: 'openrouter-gemini-flash', name: 'OR: Gemini Flash', cost: '~0,005 €', desc: 'OpenRouter — Gemini Flash' },
  { id: 'openrouter-llama', name: 'OR: Llama 4', cost: '~0,002 €', desc: 'OpenRouter — Llama 4 Maverick' },
];

/** Storage key para persistir modelo seleccionado */
const STORAGE_KEY_MODEL = 'ocr_ai_model';

/** Results may include an albaranId when the backend created an albaran record. */
type ResultsWithAlbaran = AlbaranUploadResult & { albaranId?: string };

function getAlbaranId(results: AlbaranUploadResult): string | undefined {
  return (results as ResultsWithAlbaran).albaranId;
}

export default function SubirAlbaranPage() {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [aiModel, setAiModel] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY_MODEL) || '';
  });

  const handleModelChange = (model: string) => {
    setAiModel(model);
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  };

  // API key se lee del store centralizado (configurado en /dashboard/settings)
  const aiApiKey = aiModel && aiModel !== 'regex' ? getApiKeyForModel(aiModel) : '';

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
    aiModel: aiModel && aiModel !== 'regex' ? aiModel : undefined,
    aiApiKey: aiModel && aiModel !== 'regex' ? aiApiKey : undefined,
  });

  const selectedModelInfo = AI_MODELS.find((m) => m.id === aiModel);
  const needsApiKey = aiModel && aiModel !== 'regex';

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
      {/* Back + title */}
      <Link
        href="/dashboard/albaranes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Albaranes
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Subir Albarán</h1>
        <p className="text-muted-foreground mt-1">
          Haz una foto al albarán o sube un archivo para extraer los productos automáticamente
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5">
          {/* AI Model Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Motor de extracción</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {AI_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    aiModel === model.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="text-xs font-medium truncate">{model.name}</div>
                  <div className="text-[10px] text-muted-foreground">{model.cost}/img</div>
                </button>
              ))}
            </div>
            {selectedModelInfo && (
              <p className="text-xs text-muted-foreground">{selectedModelInfo.desc}</p>
            )}

            {/* API Key status — enlace a settings si no hay key */}
            {needsApiKey && (
              <div className="space-y-1">
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
