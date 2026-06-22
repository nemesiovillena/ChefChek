'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useDigitalMenus } from '@/hooks/use-digital-menu';
import { useMenus } from '@/hooks/use-menus';
import { useQRCodes } from '@/hooks/use-qr-codes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings,
  QrCode,
  Languages,
  Filter,
  BarChart3,
  Copy,
  Download,
  Eye,
  TrendingUp,
  Globe,
  Palette,
  Plus,
  Trash2,
  Edit3,
  Share2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Info,
  Loader2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function DigitalMenuPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, tenantId } = useAuth();
  const { digitalMenus, isLoading, error, refetch, createDigitalMenu, isCreating } = useDigitalMenus();
  const { data: menus } = useMenus();
  const { generateQRCode, getQRCodesByEntity, deleteQRCode, isLoading: qrLoading } = useQRCodes();
  const [qrCodes, setQRCodes] = useState<Map<string, any>>(new Map());

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

  const [currentStep, setCurrentStep] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDescription, setNewMenuDescription] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [newMenuIsActive, setNewMenuIsActive] = useState(true);

  const handleCreateDigitalMenu = async () => {
    if (!newMenuName.trim()) return;

    try {
      await createDigitalMenu({
        name: newMenuName,
        description: newMenuDescription || undefined,
        menuId: selectedMenuId || undefined,
        isActive: newMenuIsActive,
      });
      setIsCreateModalOpen(false);
      setNewMenuName('');
      setNewMenuDescription('');
      setSelectedMenuId('');
      setNewMenuIsActive(true);
      refetch();
    } catch (error) {
      console.error('Error creating digital menu:', error);
    }
  };

  const generateQRForAllMenus = async () => {
    try {
      const menusWithoutQR = digitalMenus.filter(menu => !qrCodes.has(menu.id));

      for (const menu of menusWithoutQR) {
        try {
          const qrCode = await generateQRCode({
            entityType: 'digital-menu',
            entityId: menu.id,
            data: { tenantId: tenantId || '' },
            config: {
              qrType: 'static',
              format: 'png',
              errorCorrection: 'M',
              size: 300,
            },
          });

          setQRCodes(prev => new Map(prev).set(menu.id, qrCode));
        } catch (err) {
          console.error(`Error generating QR for menu ${menu.id}:`, err);
        }
      }

      refetch();
    } catch (error) {
      console.error('Error generating QR codes:', error);
    }
  };

  const handleDeleteQR = async (menuId: string, qrCodeId: string) => {
    try {
      await deleteQRCode(qrCodeId);
      setQRCodes(prev => {
        const newMap = new Map(prev);
        newMap.delete(menuId);
        return newMap;
      });
      refetch();
    } catch (error) {
      console.error('Error deleting QR code:', error);
    }
  };

  const handleDownloadQR = async (menuId: string) => {
    const qrCode = qrCodes.get(menuId);
    if (!qrCode?.qrCodeUrl) return;

    try {
      const response = await fetch(qrCode.qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-menu-${menuId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const steps = [
    { title: 'Cartas', icon: Settings },
    { title: 'Código QR', icon: QrCode },
    { title: 'Traducciones', icon: Languages },
    { title: 'Filtros', icon: Filter },
    { title: 'Analytics', icon: BarChart3 },
  ];



  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gestión de Cartas Digitales</h2>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Carta
              </Button>
            </div>

            {isCreateModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Crear Nueva Carta Digital</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={newMenuName}
                      onChange={(e) => setNewMenuName(e.target.value)}
                      placeholder="Nombre de la carta digital"
                    />
                  </div>
                  <div>
                    <Label>Descripción</Label>
                    <Textarea
                      value={newMenuDescription}
                      onChange={(e) => setNewMenuDescription(e.target.value)}
                      placeholder="Descripción de la carta digital"
                    />
                  </div>
                  <div>
                    <Label>Menú asociado</Label>
                    <Select value={selectedMenuId} onValueChange={(value) => setSelectedMenuId(value || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un menú" />
                      </SelectTrigger>
                      <SelectContent>
                        {(menus || []).map((menu) => (
                          <SelectItem key={menu.id} value={menu.id}>
                            {menu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Activar carta</Label>
                      <p className="text-sm text-muted-foreground">
                        Habilita la carta digital para público
                      </p>
                    </div>
                    <Switch
                      checked={newMenuIsActive}
                      onCheckedChange={setNewMenuIsActive}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreateModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateDigitalMenu}>
                      Crear Carta
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
                  No se pudieron cargar las cartas digitales. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {digitalMenus.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No hay cartas digitales</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Crea tu primera carta digital para empezar a usar la funcionalidad de QR
                      </p>
                      <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Primera Carta
                      </Button>
                    </Card>
                  ) : (
                    digitalMenus.map((menu) => (
                      <Card key={menu.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{menu.name}</h3>
                              <Badge variant={menu.isActive ? 'default' : 'secondary'}>
                                {menu.isActive ? 'Activa' : 'Inactiva'}
                              </Badge>
                            </div>
                            {menu.description && (
                              <p className="text-sm text-muted-foreground mb-3">{menu.description}</p>
                            )}
                            <div className="flex items-center gap-6 text-sm">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                <span>{menu.views} vistas</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                <span>{menu.clicks} clics</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <QrCode className="h-4 w-4" />
                                <span>
                                  {menu.qrCode ? 'QR generado' : 'Sin QR'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span>Creado: {new Date(menu.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
              <h2 className="text-2xl font-bold">Códigos QR</h2>
              <Button onClick={() => generateQRForAllMenus()}>
                <Plus className="mr-2 h-4 w-4" />
                Generar QR para todas las cartas
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid gap-4">
                {digitalMenus.length === 0 ? (
                  <Card className="p-12 flex flex-col items-center justify-center">
                    <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin cartas digitales</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Crea tu primera carta digital para generar códigos QR
                    </p>
                  </Card>
                ) : digitalMenus.filter(m => qrCodes.has(m.id)).length === 0 ? (
                  <Card className="p-12 flex flex-col items-center justify-center">
                    <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin códigos QR</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      No hay códigos QR generados todavía
                    </p>
                  </Card>
                ) : (
                  digitalMenus
                    .filter(m => qrCodes.has(m.id))
                    .map((menu) => {
                      const qrCode = qrCodes.get(menu.id);
                      return (
                        <Card key={menu.id} className="p-6">
                          <div className="flex items-start gap-6">
                            <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                              {qrCode?.qrCodeUrl ? (
                                <img
                                  src={qrCode.qrCodeUrl}
                                  alt={`QR para ${menu.name}`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <QrCode className="h-20 w-20" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold mb-2">{menu.name}</h3>
                              <p className="text-sm text-muted-foreground">{menu.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  <span>{qrCode?.scanCount || 0} escaneos</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  <span>Creado: {new Date(qrCode?.generatedAt || Date.now()).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadQR(menu.id)}
                                disabled={!qrCode?.qrCodeUrl || qrLoading}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Descargar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(qrCode?.publicUrl || '')}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar URL
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteQR(menu.id, qrCode?.qrCodeId)}
                                disabled={qrLoading}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
              </div>
            </ScrollArea>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Traducciones</h2>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Funcionalidad en desarrollo</AlertTitle>
              <AlertDescription>
                El sistema de traducciones multi-idioma estará disponible pronto.
              </AlertDescription>
            </Alert>

            <Card className="p-12 flex flex-col items-center justify-center">
              <Languages className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin traducciones</h3>
              <p className="text-sm text-muted-foreground text-center">
                Las traducciones estarán disponibles en una futura actualización
              </p>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Filtros de Alérgenos</h2>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Funcionalidad en desarrollo</AlertTitle>
              <AlertDescription>
                Los filtros de alérgenos estarán disponibles pronto cuando se integre con el módulo de alérgenos.
              </AlertDescription>
            </Alert>

            <Card className="p-6">
              <CardHeader>
                <CardTitle>Configuración Global de Filtros</CardTitle>
                <CardDescription>
                  Configura los filtros de alérgenos disponibles para todas las cartas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Activar filtros</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilita la funcionalidad de filtros de alérgenos
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div>
                  <Label>Alérgenos disponibles</Label>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {[
                      'Gluten',
                      'Crustáceos',
                      'Huevos',
                      'Pescado',
                      'Cacahuetes',
                      'Soja',
                      'Leche',
                      'Frutos de cáscara',
                      'Apio',
                      'Mostaza',
                      'Sésamo',
                      'Dióxido de azufre',
                      'Altramuces',
                      'Moluscos',
                    ].map((allergen) => (
                      <div key={allergen} className="flex items-center space-x-2">
                        <Switch defaultChecked id={allergen} />
                        <Label htmlFor={allergen}>{allergen}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Posición de filtros</Label>
                  <Select defaultValue="top">
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecciona posición" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Arriba</SelectItem>
                      <SelectItem value="bottom">Abajo</SelectItem>
                      <SelectItem value="side">Lateral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar iconos</Label>
                    <p className="text-sm text-muted-foreground">
                      Muestra iconos visuales junto al nombre del alérgeno
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Selección múltiple</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite seleccionar múltiples alérgenos simultáneamente
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Analytics</h2>
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

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Funcionalidad en desarrollo</AlertTitle>
              <AlertDescription>
                Los analytics detallados estarán disponibles pronto.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Vistas Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {digitalMenus.reduce((sum, m) => sum + m.views, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    Todas las cartas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Interacciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {digitalMenus.reduce((sum, m) => sum + m.clicks, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    Todas las cartas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Interacción Media
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {digitalMenus.length > 0
                      ? (digitalMenus.reduce((sum, m) => sum + m.clicks, 0) /
                          digitalMenus.reduce((sum, m) => sum + m.views, 0)).toFixed(2)
                      : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por vista de carta
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="p-12 flex flex-col items-center justify-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Analytics detallados</h3>
              <p className="text-sm text-muted-foreground text-center">
                Los analytics detallados estarán disponibles en una futura actualización
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
        <h1 className="text-3xl font-bold">Carta Digital QR</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de cartas digitales con códigos QR, multi-idioma y filtros de
          alérgenos
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
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
      </div>

      <div className="border-t pt-6">{renderStepContent()}</div>
    </div>
  );
}