'use client';

import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlbaranUpload } from '@/hooks/use-albaran-upload';

interface AlbaranUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  suppliers?: Array<{ id: string; name: string }>;
}

export default function AlbaranUploadDrawer({
  isOpen,
  onClose,
  onImportComplete,
  suppliers = [],
}: AlbaranUploadDrawerProps) {
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
    supplierName: suppliers[0]?.name,
    onImportComplete,
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      {/* Header */}
      <div className="px-6 pb-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Importar desde Albarán</h2>
              <p className="text-sm text-gray-500">
                Sube un albarán o factura para extraer productos automáticamente
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea>
        <div className="p-6 space-y-6">
          {/* Upload Area */}
          <Card>
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
                  JPG, PNG, PDF — máx 10MB por archivo
                </p>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
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
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {/* Process Button */}
              {!isUploading && files.length > 0 && !results && (
                <Button className="w-full" onClick={processFiles}>
                  <Upload className="mr-2 h-4 w-4" />
                  Procesar Albarán
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {results && (
            <Card>
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
                <ScrollArea className="max-h-60">
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
                        {product.matchedProductName && (
                          <div className="text-xs text-muted-foreground">
                            Coincide con: {product.matchedProductName}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          product.confidence >= 0.7 ? 'default' : 'secondary'
                        }
                      >
                        {(product.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </ScrollArea>

                {/* Import Action */}
                <div className="pt-4 border-t flex-shrink-0">
                  <Button
                    onClick={handleImport}
                    disabled={isUploading}
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Importar {results.products.filter((p) => p.confidence >= 0.5).length} productos
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    Cerrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isUploading && results === null && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arrastra un albarán o factura para comenzar
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
