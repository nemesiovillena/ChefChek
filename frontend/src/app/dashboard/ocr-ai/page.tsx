'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  ScanLine,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Eye,
  Edit3,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Zap,
  BarChart3,
  Settings,
  Plus,
  FileImage,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function OcrAiPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Prevent loading if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const steps = [
    { title: 'Procesamiento', icon: ScanLine },
    { title: 'Extracciones', icon: BrainCircuit },
    { title: 'Productos', icon: FileText },
    { title: 'Costes', icon: TrendingUp },
    { title: 'Estadísticas', icon: BarChart3 },
  ];

  const [extractions] = useState([
    {
      id: '1',
      fileId: 'f1',
      fileName: 'factura_proveedor_20260531.pdf',
      documentType: 'invoice',
      totalItems: 5,
      confidence: 0.92,
      processingTime: 4500,
      needsManualReview: false,
      processedAt: '2026-05-31T10:30:00',
      status: 'completed',
    },
    {
      id: '2',
      fileId: 'f2',
      fileName: 'recibo_materiales.jpg',
      documentType: 'receipt',
      totalItems: 3,
      confidence: 0.78,
      processingTime: 3200,
      needsManualReview: true,
      processedAt: '2026-05-31T09:45:00',
      status: 'completed',
    },
    {
      id: '3',
      fileId: 'f3',
      fileName: 'lista_precios.xlsx',
      documentType: 'price_list',
      totalItems: 0,
      confidence: 0.65,
      processingTime: 2800,
      needsManualReview: true,
      processedAt: '2026-05-31T08:20:00',
      status: 'completed',
    },
  ]);

  const [products] = useState([
    {
      id: 'p1',
      name: 'Tomates Frescos',
      supplier: 'Frutas y Verduras S.A.',
      unitPrice: 2.50,
      previousPrice: 2.30,
      changePercentage: 8.7,
      confidence: 0.92,
      source: 'auto',
      createdAt: '2026-05-31T10:30:00',
      status: 'verified',
    },
    {
      id: 'p2',
      name: 'Aceite de Oliva Virgen',
      supplier: 'Proveedores de Calidad',
      unitPrice: 3.00,
      previousPrice: 2.85,
      changePercentage: 5.3,
      confidence: 0.88,
      source: 'auto',
      createdAt: '2026-05-31T09:45:00',
      status: 'verified',
    },
    {
      id: 'p3',
      name: 'Carne de Res Premium',
      supplier: 'Carniceros del Norte',
      unitPrice: 4.50,
      previousPrice: null,
      changePercentage: null,
      confidence: 0.78,
      source: 'auto',
      createdAt: '2026-05-31T08:20:00',
      status: 'pending',
    },
  ]);

  const [costUpdates] = useState([
    {
      id: 'c1',
      productId: 'prod1',
      productName: 'Tomates Frescos',
      oldPrice: 2.30,
      newPrice: 2.50,
      changePercentage: 8.7,
      confidence: 0.92,
      recalculationStatus: 'completed',
      affectedRecipes: 3,
      affectedMenus: 2,
      updatedAt: '2026-05-31T10:32:00',
    },
    {
      id: 'c2',
      productId: 'prod2',
      productName: 'Aceite de Oliva Virgen',
      oldPrice: 2.85,
      newPrice: 3.00,
      changePercentage: 5.3,
      confidence: 0.88,
      recalculationStatus: 'completed',
      affectedRecipes: 5,
      affectedMenus: 3,
      updatedAt: '2026-05-31T09:47:00',
    },
  ]);

  const [stats] = useState({
    totalProcessed: 45,
    successfulExtractions: 38,
    failedExtractions: 2,
    needsReview: 5,
    averageConfidence: 0.85,
    averageProcessingTime: 4200,
    totalProductsCreated: 23,
    totalCostsUpdated: 31,
    totalRecipesRecalculated: 89,
    totalMenusRecalculated: 45,
    documentTypes: [
      { type: 'Facturas', count: 28, percentage: 62.2 },
      { type: 'Recibos', count: 12, percentage: 26.7 },
      { type: 'Listas de Precio', count: 5, percentage: 11.1 },
    ],
  });

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Procesamiento OCR + IA</h2>
              <Button>
                <ScanLine className="mr-2 h-4 w-4" />
                Procesar Documentos
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Procesados</p>
                    <p className="text-3xl font-bold">{stats.totalProcessed}</p>
                  </div>
                </div>
                <Progress value={100} className="mt-2" />
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Exitosos</p>
                    <p className="text-3xl font-bold text-green-600">{stats.successfulExtractions}</p>
                  </div>
                </div>
                <Progress value={(stats.successfulExtractions / stats.totalProcessed) * 100} className="mt-2" />
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revisión Manual</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.needsReview}</p>
                  </div>
                </div>
                <Progress value={(stats.needsReview / stats.totalProcessed) * 100} className="mt-2" />
              </Card>
            </div>

            <Card className="p-6">
              <CardHeader>
                <CardTitle>Configuración de Procesamiento</CardTitle>
                <CardDescription>
                  Configura el motor de OCR y el sistema de extracción de IA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Proveedor de OCR</Label>
                  <Select defaultValue="google">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tesseract">Tesseract (Open Source)</SelectItem>
                      <SelectItem value="google">Google Cloud Vision</SelectItem>
                      <SelectItem value="azure">Azure Computer Vision</SelectItem>
                      <SelectItem value="aws">AWS Textract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Idioma del Documento</Label>
                  <Select defaultValue="spa">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spa">Español</SelectItem>
                      <SelectItem value="eng">Inglés</SelectItem>
                      <SelectItem value="fra">Francés</SelectItem>
                      <SelectItem value="deu">Alemán</SelectItem>
                      <SelectItem value="ita">Italiano</SelectItem>
                      <SelectItem value="por">Portugués</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Confianza Mínima</Label>
                  <Input type="number" defaultValue="70" min="50" max="100" className="mt-2" />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Crear Productos</Label>
                      <p className="text-sm text-muted-foreground">
                        Crear productos automáticamente cuando la confianza sea alta
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Actualizar Costes Existentes</Label>
                      <p className="text-sm text-muted-foreground">
                        Actualizar costes de productos ya existentes
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Recálculo en Cascada</Label>
                      <p className="text-sm text-muted-foreground">
                        Recalcular recetas y menús automáticamente
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Preprocesamiento de Imágenes</Label>
                      <p className="text-sm text-muted-foreground">
                        Mejorar calidad de imágenes antes de OCR
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Button className="w-full">
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Extracciones IA</h2>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                  <SelectItem value="needs_review">Revisión Manual</SelectItem>
                  <SelectItem value="failed">Fallidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid gap-4">
                {extractions.map((extraction) => (
                  <Card key={extraction.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            extraction.documentType === 'invoice'
                              ? 'bg-red-500/10 text-red-500'
                              : extraction.documentType === 'receipt'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-gray-500/10 text-gray-500'
                          }`}
                        >
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{extraction.fileName}</h3>
                          <Badge variant="outline">{extraction.documentType}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {extraction.needsManualReview ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Revisión Manual
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Completado
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Items Extraídos</p>
                        <p className="text-2xl font-bold">{extraction.totalItems}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Confianza</p>
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-bold">
                            {(extraction.confidence * 100).toFixed(0)}%
                          </div>
                          <Progress
                            value={extraction.confidence * 100}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tiempo</p>
                        <p className="text-2xl font-bold">
                          {extraction.processingTime}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Procesado</p>
                        <p className="text-sm font-medium">
                          {new Date(extraction.processedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {extraction.needsManualReview && (
                        <Button variant="outline" size="sm">
                          <Edit3 className="mr-2 h-4 w-4" />
                          Revisar Manualmente
                        </Button>
                      )}
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Productos Creados Automáticamente</h2>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear Producto Manual
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Creados</span>
                    <span className="text-2xl font-bold">{stats.totalProductsCreated}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Confianza Promedio</span>
                    <span className="text-2xl font-bold">
                      {(stats.averageConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tiempo Promedio</span>
                    <span className="text-2xl font-bold">
                      {stats.averageProcessingTime}ms
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estado de Productos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Verificados</span>
                      <span className="text-sm font-medium">19</span>
                    </div>
                    <Progress value={(19 / stats.totalProductsCreated) * 100} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Pendientes</span>
                      <span className="text-sm font-medium">3</span>
                    </div>
                    <Progress value={(3 / stats.totalProductsCreated) * 100} className="bg-yellow-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Rechazados</span>
                      <span className="text-sm font-medium">1</span>
                    </div>
                    <Progress value={(1 / stats.totalProductsCreated) * 100} className="bg-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <ScrollArea className="h-[calc(100vh-500px)]">
              <div className="grid gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{product.name}</h3>
                          <Badge variant="outline">{product.supplier}</Badge>
                          <Badge
                            variant={
                              product.status === 'verified'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {product.status === 'verified' ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Verificado
                              </>
                            ) : (
                              <>
                                <Clock className="mr-1 h-3 w-3" />
                                Pendiente
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline">
                            <Zap className="mr-1 h-3 w-3" />
                            Auto
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Precio Actual</p>
                            <p className="font-medium">€{product.unitPrice.toFixed(2)}</p>
                          </div>
                          {product.previousPrice && (
                            <div>
                              <p className="text-muted-foreground">Precio Anterior</p>
                              <p className="font-medium">€{product.previousPrice.toFixed(2)}</p>
                            </div>
                          )}
                          {product.changePercentage !== null && (
                            <div>
                              <p className="text-muted-foreground">Cambio</p>
                              <p
                                className={`font-medium ${
                                  product.changePercentage > 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {product.changePercentage > 0 ? '+' : ''}
                                {product.changePercentage.toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm mt-2">
                          <div className="flex items-center gap-2">
                            <BrainCircuit className="h-4 w-4" />
                            <span>Confianza: {(product.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Creado: {new Date(product.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Actualizaciones de Costes</h2>
              <Button>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalcular Todo
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Actualizados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalCostsUpdated}</div>
                  <div className="text-xs text-muted-foreground mt-1">Costes de productos</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recetas Recalculadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalRecipesRecalculated}</div>
                  <div className="text-xs text-muted-foreground mt-1">Actualizadas automáticamente</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Menús Recalculados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalMenusRecalculated}</div>
                  <div className="text-xs text-muted-foreground mt-1">Actualizados automáticamente</div>
                </CardContent>
              </Card>
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid gap-4">
                {costUpdates.map((update) => (
                  <Card key={update.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{update.productName}</h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Precio Anterior</p>
                            <p className="font-medium text-red-600 line-through">
                              €{update.oldPrice.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Nuevo Precio</p>
                            <p className="font-medium text-green-600">
                              €{update.newPrice.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cambio</p>
                            <p
                              className={`font-medium ${
                                update.changePercentage > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {update.changePercentage > 0 ? '+' : ''}
                              {update.changePercentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-muted-foreground">Recetas Afectadas</p>
                        <p className="font-medium">{update.affectedRecipes}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Menús Afectados</p>
                        <p className="font-medium">{update.affectedMenus}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Recalculado</p>
                        <p className="font-medium">
                          {new Date(update.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <BrainCircuit className="h-4 w-4" />
                        <span>Confianza: {(update.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Badge variant="outline">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Recalculado
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Estadísticas OCR + IA</h2>
              <Select defaultValue="30">
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Procesados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalProcessed}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Documentos
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {((stats.successfulExtractions / stats.totalProcessed) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Extracciones exitosas
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Confianza Promedio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {(stats.averageConfidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Precisión de extracción
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {(stats.averageProcessingTime / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Por documento
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <CardHeader>
                  <CardTitle className="text-lg">Documentos por Tipo</CardTitle>
                  <CardDescription>
                    Distribución de documentos procesados por tipo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats.documentTypes.map((type) => (
                    <div key={type.type}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{type.type}</span>
                        <span className="text-sm text-muted-foreground">
                          {type.count} ({type.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={type.percentage} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardHeader>
                  <CardTitle className="text-lg">Impacto en Cascada</CardTitle>
                  <CardDescription>
                    Recalculaciones automáticas de recetas y menús
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Productos Creados</span>
                    <span className="font-medium">{stats.totalProductsCreated}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Costes Actualizados</span>
                    <span className="font-medium">{stats.totalCostsUpdated}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Recetas Recalculadas</span>
                    <span className="font-medium">{stats.totalRecipesRecalculated}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Menús Recalculados</span>
                    <span className="font-medium">{stats.totalMenusRecalculated}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">OCR + IA</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de procesamiento inteligente de documentos con OCR y IA
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.title} className="flex items-center">
              <button
                onClick={() => setCurrentStep(index)}
                className={`flex flex-col items-center gap-1 transition-all ${
                  currentStep === index
                    ? 'scale-110'
                    : 'hover:scale-105'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= index
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-1 ${
                    currentStep > index ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-6">{renderStepContent()}</div>
    </div>
  );
}