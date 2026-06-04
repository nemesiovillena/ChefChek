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
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function IngestionPage() {
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
    { title: 'Mensajes', icon: Inbox },
    { title: 'Archivos', icon: FileText },
    { title: 'Cola', icon: Clock },
    { title: 'Estadísticas', icon: BarChart3 },
    { title: 'Configuración', icon: Settings },
  ];

  const [messages] = useState([
    {
      id: '1',
      messageType: 'document',
      username: 'user123',
      firstName: 'Juan',
      lastName: 'Pérez',
      fileCount: 1,
      status: 'completed',
      receivedAt: '2026-05-31T10:30:00',
      processedAt: '2026-05-31T10:32:00',
    },
    {
      id: '2',
      messageType: 'photo',
      username: 'chefmaria',
      firstName: 'María',
      lastName: 'García',
      fileCount: 3,
      status: 'completed',
      receivedAt: '2026-05-31T09:45:00',
      processedAt: '2026-05-31T09:48:00',
    },
    {
      id: '3',
      messageType: 'document',
      username: 'providercorp',
      firstName: 'Proveedor',
      lastName: 'Corp',
      fileCount: 1,
      status: 'failed',
      receivedAt: '2026-05-31T08:20:00',
      errorMessage: 'Formato de archivo no soportado',
    },
  ]);

  const [files] = useState([
    {
      id: '1',
      fileName: 'factura_proveedor_20260531.pdf',
      fileType: 'pdf',
      fileSize: 1024000,
      status: 'completed',
      receivedAt: '2026-05-31T10:30:00',
      processedAt: '2026-05-31T10:32:00',
      extractedData: true,
    },
    {
      id: '2',
      fileName: 'foto_plato_01.jpg',
      fileType: 'image',
      fileSize: 2048000,
      status: 'completed',
      receivedAt: '2026-05-31T09:45:00',
      processedAt: '2026-05-31T09:48:00',
      extractedData: false,
    },
    {
      id: '3',
      fileName: 'documento_invalido.doc',
      fileType: 'document',
      fileSize: 512000,
      status: 'failed',
      receivedAt: '2026-05-31T08:20:00',
      errorMessage: 'Formato no soportado',
    },
  ]);

  const [queue] = useState([
    {
      id: '1',
      fileId: 'f4',
      fileName: 'factura_pendiente.pdf',
      fileType: 'pdf',
      status: 'processing',
      priority: 8,
      queuedAt: '2026-05-31T12:00:00',
      startedAt: '2026-05-31T12:01:00',
      progress: 75,
    },
    {
      id: '2',
      fileId: 'f5',
      fileName: 'imagen_receta.jpg',
      fileType: 'image',
      status: 'pending',
      priority: 6,
      queuedAt: '2026-05-31T12:05:00',
      progress: 0,
    },
    {
      id: '3',
      fileId: 'f6',
      fileName: 'documento_importante.pdf',
      fileType: 'pdf',
      status: 'pending',
      priority: 5,
      queuedAt: '2026-05-31T12:07:00',
      progress: 0,
    },
  ]);

  const [stats] = useState({
    totalMessages: 145,
    totalFiles: 289,
    processedFiles: 256,
    failedFiles: 12,
    pendingFiles: 21,
    averageProcessingTime: 4500,
    topFileTypes: [
      { type: 'PDF', count: 156, percentage: 54.0 },
      { type: 'Image', count: 89, percentage: 30.8 },
      { type: 'Document', count: 44, percentage: 15.2 },
    ],
    todayStats: {
      messages: 23,
      files: 45,
      processed: 38,
      failed: 2,
    },
  });

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Mensajes Recibidos</h2>
              <Button>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid gap-4">
                {messages.map((message) => (
                  <Card key={message.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            {message.firstName} {message.lastName} @{message.username}
                          </h3>
                          <Badge
                            variant={
                              message.status === 'completed'
                                ? 'default'
                                : message.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {message.status === 'completed' ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Completado
                              </>
                            ) : message.status === 'failed' ? (
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
                          <Badge variant="outline">
                            <Upload className="mr-1 h-3 w-3" />
                            {message.messageType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{message.fileCount} archivo(s)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{new Date(message.receivedAt).toLocaleString()}</span>
                          </div>
                          {message.processedAt && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Procesado: {new Date(message.processedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {message.errorMessage && (
                          <div className="mt-3 p-2 bg-destructive/10 text-destructive rounded-md text-sm">
                            <AlertTriangle className="inline h-3 w-3 mr-2" />
                            {message.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Archivos Recibidos</h2>
              <Button>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid gap-4">
                {files.map((file) => (
                  <Card key={file.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            file.fileType === 'image'
                              ? 'bg-blue-500/10 text-blue-500'
                              : file.fileType === 'pdf'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-gray-500/10 text-gray-500'
                          }`}
                        >
                          {file.fileType === 'image' ? (
                            <ImageIcon className="h-6 w-6" />
                          ) : (
                            <FileText className="h-6 w-6" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{file.fileName}</h3>
                            <Badge
                              variant={
                                file.status === 'completed'
                                  ? 'default'
                                  : file.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {file.status === 'completed' ? (
                                <>
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Completado
                                </>
                              ) : file.status === 'failed' ? (
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
                              <HardDrive className="h-4 w-4" />
                              <span>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{new Date(file.receivedAt).toLocaleString()}</span>
                            </div>
                            {file.processedAt && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Procesado: {new Date(file.processedAt).toLocaleString()}</span>
                              </div>
                            )}
                            {file.extractedData && (
                              <Badge variant="outline">
                                <Zap className="mr-1 h-3 w-3" />
                                Datos extraídos
                              </Badge>
                            )}
                          </div>
                          {file.errorMessage && (
                            <div className="mt-3 p-2 bg-destructive/10 text-destructive rounded-md text-sm">
                              <AlertTriangle className="inline h-3 w-3 mr-2" />
                              {file.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                        {file.status === 'failed' && (
                          <Button variant="ghost" size="icon">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
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

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Cola de Procesamiento</h2>
              <Button>
                <RefreshCw className="mr-2 h-4 w-4" />
                Procesar Cola
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid gap-4">
                {queue.map((item) => (
                  <Card key={item.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{item.fileName}</h3>
                          <Badge
                            variant={
                              item.status === 'processing'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {item.status === 'processing' ? (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Procesando
                              </>
                            ) : (
                              <>
                                <Clock className="mr-1 h-3 w-3" />
                                Pendiente
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline">Prioridad: {item.priority}</Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Encolado: {new Date(item.queuedAt).toLocaleString()}</span>
                          </div>
                          {item.startedAt && (
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              <span>Iniciado: {new Date(item.startedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.status === 'processing' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progreso</span>
                          <span>{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} />
                      </div>
                    )}
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
              <h2 className="text-2xl font-bold">Estadísticas</h2>
              <Select defaultValue="7">
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Último día</SelectItem>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Mensajes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalMessages}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    +{stats.todayStats.messages} hoy
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Archivos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalFiles}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    +{stats.todayStats.files} hoy
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Procesados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {stats.processedFiles}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((stats.processedFiles / stats.totalFiles) * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Fallidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {stats.failedFiles}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((stats.failedFiles / stats.totalFiles) * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">
                    {stats.pendingFiles}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((stats.pendingFiles / stats.totalFiles) * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <CardHeader>
                  <CardTitle className="text-lg">Archivos por Tipo</CardTitle>
                  <CardDescription>
                    Distribución de archivos por tipo de formato
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats.topFileTypes.map((type) => (
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
                  <CardTitle className="text-lg">Tiempo de Procesamiento</CardTitle>
                  <CardDescription>
                    Promedio de tiempo de procesamiento por archivo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="text-5xl font-bold">
                        {(stats.averageProcessingTime / 1000).toFixed(1)}s
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Tiempo promedio por archivo
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Mejor rendimiento
                      </span>
                      <span className="font-medium">2.3s</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                        Promedio actual
                      </span>
                      <span className="font-medium">{(stats.averageProcessingTime / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-red-500" />
                        Peor rendimiento
                      </span>
                      <span className="font-medium">8.7s</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Configuración de Bot</h2>
            </div>

            <Card className="p-6">
              <CardHeader>
                <CardTitle>Configuración de Telegram</CardTitle>
                <CardDescription>
                  Configura el bot de Telegram para ingesta de archivos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="botToken">Token del Bot</Label>
                  <Input
                    id="botToken"
                    type="password"
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Obtenido de @BotFather en Telegram
                  </p>
                </div>

                <div>
                  <Label htmlFor="webhookUrl">URL de Webhook</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://chefchek.com/api/v1/telegram-ingestion/webhook"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="secretToken">Token Secreto (Opcional)</Label>
                  <Input
                    id="secretToken"
                    type="password"
                    placeholder="your-secret-token"
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Token para validar webhooks entrantes
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Habilitar subida de archivos</Label>
                      <p className="text-sm text-muted-foreground">
                        Permite a los usuarios enviar archivos
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Habilitar mensajes de texto</Label>
                      <p className="text-sm text-muted-foreground">
                        Permite mensajes de texto sin archivos
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Respuesta automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Responde automáticamente a los mensajes
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="welcomeMessage">Mensaje de Bienvenida</Label>
                  <Textarea
                    id="welcomeMessage"
                    placeholder="¡Hola! Soy el bot de ChefChek. Envíame tus facturas y documentos y los procesaré automáticamente."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="helpMessage">Mensaje de Ayuda</Label>
                  <Textarea
                    id="helpMessage"
                    placeholder="Puedes enviarme imágenes, PDFs y documentos. Los procesaré y te notificaré cuando termine."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <Button className="w-full">
                  Guardar Configuración
                </Button>
              </CardContent>
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
        <h1 className="text-3xl font-bold">Ingesta Omnicanal</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de ingesta de documentos vía Telegram con procesamiento automático
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