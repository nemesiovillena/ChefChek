'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, XCircle, ExternalLink, Sparkles, Settings } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAlbaranUpload } from '@/hooks/use-albaran-upload';
import { getApiKeyForModel } from '@/lib/ai-api-keys';

export const dynamic = 'force-dynamic';

/** Modelos IA disponibles con info de coste */
const AI_MODELS = [
  { id: 'regex', name: 'Solo OCR (gratis)', cost: '0€', desc: 'Regex básico, sin coste' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', cost: '~0.01€', desc: 'Rápido y barato, buena precisión' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', cost: '~0.005€', desc: 'El más barato, muy buena visión' },
  { id: 'gpt-4o', name: 'GPT-4o', cost: '~0.05€', desc: 'Máxima precisión, más caro' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', cost: '~0.01€', desc: 'Buen balance calidad/precio' },
  { id: 'openrouter-gpt-4o-mini', name: 'OR: GPT-4o Mini', cost: '~0.01€', desc: 'OpenRouter — GPT-4o Mini' },
  { id: 'openrouter-claude-haiku', name: 'OR: Claude Haiku', cost: '~0.01€', desc: 'OpenRouter — Claude Haiku' },
  { id: 'openrouter-gemini-flash', name: 'OR: Gemini Flash', cost: '~0.005€', desc: 'OpenRouter — Gemini Flash' },
  { id: 'openrouter-llama', name: 'OR: Llama 4', cost: '~0.002€', desc: 'OpenRouter — Llama 4 Maverick' },
];

/** Storage key para persistir modelo seleccionado */
const STORAGE_KEY_MODEL = 'ocr_ai_model';

export default function IngestionPage() {
  const [aiModel, setAiModel] = useState<string>('');

  // Cargar modelo guardado
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedModel = localStorage.getItem(STORAGE_KEY_MODEL) || '';
    setAiModel(savedModel);
  }, []);

  const handleModelChange = (model: string) => {
    setAiModel(model);
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  };

  // API key se lee del store centralizado (configurado en /dashboard/settings)
  const aiApiKey = aiModel && aiModel !== 'regex' ? getApiKeyForModel(aiModel) : '';

  const {
    fileInputRef,
    files,
    isDragging,
    isUploading,
    uploadProgress,
    results,
    error,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    removeFile,
    processFiles,
    handleImport,
    reset,
  } = useAlbaranUpload({
    aiModel: aiModel && aiModel !== 'regex' ? aiModel : undefined,
    aiApiKey: aiModel && aiModel !== 'regex' ? aiApiKey : undefined,
  });

  const selectedModelInfo = AI_MODELS.find(m => m.id === aiModel);
  const needsApiKey = aiModel && aiModel !== 'regex';

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Importar desde Albarán</h1>
        <p className="text-muted-foreground mt-1">
          Sube un albarán o factura para extraer productos automáticamente
        </p>
      </div>

      <Card>
        <CardContent>
          {/* AI Model Selector */}
          <div className="mb-6 space-y-3">
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
                  <Link href="/dashboard/settings" className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    Configura la API Key en Ajustes
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Arrastra aquí tu albarán o factura
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Seleccionar archivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              JPG, PNG, HEIC, PDF — máx 10MB por archivo
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium">Archivos seleccionados</h3>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="mt-6 space-y-2">
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
            <div className="mt-6">
              <Button className="w-full" onClick={processFiles}>
                <Upload className="mr-2 h-4 w-4" />
                Procesar Albarán
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Productos Detectados</CardTitle>
              <Badge variant="default">
                {results.products.length} productos
              </Badge>
            </div>
            <CardDescription>
              {results.products.length} producto{results.products.length !== 1 ? 's' : ''} detectados
              con {results.products.filter((p) => p.confidence >= 0.7).length} de alta confianza
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.products.map((product, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
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
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{product.quantity} {product.unit}</span>
                    <span>•</span>
                    <span className="font-medium text-foreground">
                      €{product.unit_price.toFixed(2)}
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

            <div className="pt-4 border-t flex gap-2">
              <Button onClick={handleImport} disabled={isUploading} className="flex-1">
                Importar {results.products.filter((p) => p.confidence >= 0.5).length} productos
              </Button>
              <Link href={(results as any)?.albaranId ? `/dashboard/albaranes/${(results as any).albaranId}` : '/dashboard/albaranes'}>
                <Button variant="outline" className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {(results as any)?.albaranId ? 'Ver Albarán' : 'Ver en Albaranes'}
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
