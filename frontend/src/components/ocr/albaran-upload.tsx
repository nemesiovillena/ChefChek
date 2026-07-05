'use client';

import { Upload, FileText, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEuro } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAlbaranUpload } from '@/hooks/use-albaran-upload';

/** Standalone card component for albarán OCR upload (no import action) */
export function AlbaranUpload() {
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
    reset,
  } = useAlbaranUpload();

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Subir Albarán</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Arrastra aquí imágenes o PDFs de albaranes
            </p>
            <Button
              type="button"
              className="border border-gray-300 hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
            >
              Seleccionar Archivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
                </p>
                {error && (
                  <Badge variant="destructive">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Error
                  </Badge>
                )}
              </div>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
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

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Progress */}
              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Procesando albarán...</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {/* Process Button */}
              {!isUploading && !results && (
                <Button
                  className="w-full mt-4"
                  onClick={processFiles}
                  disabled={files.length === 0}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Procesar Albarán{files.length !== 1 ? 'es' : ''}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && results.products.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Productos Detectados</CardTitle>
              <Badge variant="default">
                {results.products.length} productos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
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
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {product.quantity} {product.unit}
                      </span>
                      <span>•</span>
                      <span>{formatEuro(product.unit_price)}/ud</span>
                      <span>•</span>
                      <span className="font-medium text-foreground">
                        Total: {formatEuro(product.total_price)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        product.confidence >= 0.8
                          ? 'default'
                          : product.confidence >= 0.6
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {(product.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={reset}
            >
              Subir Otro Albarán
            </Button>
          </CardContent>
        </Card>
      )}

      {results && results.products.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se detectaron productos</AlertTitle>
          <AlertDescription>
            Intenta con una imagen de mejor calidad o verifica que el albarán tenga
            el formato correcto.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
