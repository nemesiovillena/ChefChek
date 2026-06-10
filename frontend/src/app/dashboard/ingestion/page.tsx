'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useIngesta } from '@/hooks/use-ingesta';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Inbox,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Users,
  HardDrive,
  Zap,
  BarChart3,
  Settings,
  Upload,
  Image as ImageIcon,
  Loader2,
  Info,
  Plus,
  AlertCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function IngestionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { ingestaEntries, isLoading, error, refetch, createIngesta, processIngesta, isCreating } = useIngesta();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Prevent isLoading if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const handleCreateIngesta = async () => {
    if (!newImageUrl.trim()) return;

    try {
      await createIngesta({ image: newImageUrl });
      setIsCreateModalOpen(false);
      setNewImageUrl('');
      refetch();
    } catch (error) {
      console.error('Error creating ingesta:', error);
    }
  };

  const handleProcessIngesta = async (id: string) => {
    try {
      await processIngesta(id);
      refetch();
    } catch (error) {
      console.error('Error processing ingesta:', error);
    }
  };

  const steps = [
    { title: 'Entradas', icon: Inbox },
    { title: 'Procesamiento', icon: BarChart3 },
    { title: 'Configuración', icon: Settings },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Entradas de Ingesta</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Entrada
                </Button>
              </div>
            </div>

            {isCreateModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Crear Nueva Entrada de Ingesta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>URL de Imagen</Label>
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreateModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateIngesta} disabled={isCreating}>
                      {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Crear Entrada
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar las entradas de ingesta. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {ingestaEntries.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <Upload className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Sin entradas de ingesta</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Comienza a cargar imágenes para reconocimiento de artículos
                      </p>
                      <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Primera Entrada
                      </Button>
                    </Card>
                  ) : (
                    ingestaEntries.map((entry) => (
                      <Card key={entry.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            {entry.image && (
                              <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                <img src={entry.image} alt="Ingesta" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold">Entrada #{entry.id.slice(0, 8)}</h3>
                                <Badge
                                  variant={
                                    entry.status === 'completed'
                                      ? 'default'
                                      : entry.status === 'failed'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                >
                                  {entry.status === 'completed' ? (
                                    <>
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Completado
                                    </>
                                  ) : entry.status === 'failed' ? (
                                    <>
                                      <XCircle className="mr-1 h-3 w-3" />
                                      Fallido
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="mr-1 h-3 w-3" />
                                      Pendiente
                                    </>
                                  )}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  <span>{new Date(entry.processedAt || new Date()).toLocaleString()}</span>
                                </div>
                                {entry.recognizedProducts && entry.recognizedProducts.length > 0 && (
                                  <Badge variant="outline">
                                    <Zap className="mr-1 h-3 w-3" />
                                    {entry.recognizedProducts.length} artículos
                                  </Badge>
                                )}
                              </div>
                              {entry.recognizedProducts && entry.recognizedProducts.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {entry.recognizedProducts.map((product, idx) => (
                                    <Badge key={idx} variant="secondary">
                                      {product}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {entry.status === 'pending' && (
                                <Button
                                  onClick={() => handleProcessIngesta(entry.id)}
                                  variant="outline"
                                  size="sm"
                                  className="mt-3"
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Procesar
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Estadísticas de Procesamiento</h2>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Funcionalidad en desarrollo</AlertTitle>
              <AlertDescription>
                Las estadísticas detalladas de procesamiento estarán disponibles pronto.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{ingestaEntries.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Entradas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Completadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {ingestaEntries.filter(e => e.status === 'completed').length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ingestaEntries.length > 0
                      ? ((ingestaEntries.filter(e => e.status === 'completed').length / ingestaEntries.length) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Fallidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {ingestaEntries.filter(e => e.status === 'failed').length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ingestaEntries.length > 0
                      ? ((ingestaEntries.filter(e => e.status === 'failed').length / ingestaEntries.length) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">
                    {ingestaEntries.filter(e => e.status === 'pending').length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ingestaEntries.length > 0
                      ? ((ingestaEntries.filter(e => e.status === 'pending').length / ingestaEntries.length) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="p-12 flex flex-col items-center justify-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Más estadísticas</h3>
              <p className="text-sm text-muted-foreground text-center">
                Analytics avanzados estarán disponibles en una futura actualización
              </p>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Configuración</h2>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Funcionalidad en desarrollo</AlertTitle>
              <AlertDescription>
                La configuración avanzada de reconocimiento de imágenes estará disponible pronto.
              </AlertDescription>
            </Alert>

            <Card className="p-12 flex flex-col items-center justify-center">
              <Settings className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Configuración de IA</h3>
              <p className="text-sm text-muted-foreground text-center">
                Las opciones de configuración del reconocimiento de artículos estarán disponibles en una futura actualización
              </p>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Ingesta de Artículos</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de reconocimiento de artículos mediante IA
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