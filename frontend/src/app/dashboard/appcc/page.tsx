'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useAppcc } from '@/hooks/use-appcc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Thermometer,
  ClipboardCheck,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader2,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AppccPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { controls, measurements, isLoading, error, refetch, createControl, recordMeasurement, isCreating } = useAppcc();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRecordMeasurementModalOpen, setIsRecordMeasurementModalOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [newControlName, setNewControlName] = useState('');
  const [newControlDescription, setNewControlDescription] = useState('');
  const [newControlType, setNewControlType] = useState('');
  const [newControlCriticalLimit, setNewControlCriticalLimit] = useState('');
  const [newControlFrequency, setNewControlFrequency] = useState('');
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementUnit, setMeasurementUnit] = useState('');
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

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

  const steps = [
    { title: 'Controles', icon: Thermometer },
    { title: 'Mediciones', icon: TrendingUp },
  ];

  const handleCreateControl = async () => {
    if (!newControlName.trim() || !newControlType.trim()) return;

    try {
      await createControl({
        name: newControlName,
        description: newControlDescription || undefined,
        type: newControlType,
        criticalLimit: newControlCriticalLimit || undefined,
        frequency: newControlFrequency || undefined,
      });
      setIsCreateModalOpen(false);
      setNewControlName('');
      setNewControlDescription('');
      setNewControlType('');
      setNewControlCriticalLimit('');
      setNewControlFrequency('');
      refetch();
    } catch (error) {
      console.error('Error creating control:', error);
    }
  };

  const handleRecordMeasurement = async () => {
    if (!selectedControlId || !measurementValue.trim() || !measurementUnit.trim()) return;

    try {
      await recordMeasurement({
        controlId: selectedControlId,
        value: parseFloat(measurementValue),
        unit: measurementUnit,
        notes: measurementNotes || undefined,
      });
      setIsRecordMeasurementModalOpen(false);
      setSelectedControlId('');
      setMeasurementValue('');
      setMeasurementUnit('');
      setMeasurementNotes('');
      refetch();
    } catch (error) {
      console.error('Error recording measurement:', error);
    }
  };

  const getControlStatusBadge = (status: string) => {
    type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
    const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      in_progress: { label: 'En Progreso', variant: 'default' },
      completed: { label: 'Completado', variant: 'default' },
      failed: { label: 'Fallido', variant: 'destructive' },
    };
    const config = statusConfig[status.toLowerCase()] || { label: status, variant: 'secondary' as BadgeVariant };
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Controles APPCC</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Control
                </Button>
              </div>
            </div>

            {isCreateModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Crear Nuevo Control</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nombre del Control</Label>
                    <Input
                      value={newControlName}
                      onChange={(e) => setNewControlName(e.target.value)}
                      placeholder="Temperatura de congelación"
                    />
                  </div>
                  <div>
                    <Label>Descripción (opcional)</Label>
                    <Textarea
                      value={newControlDescription}
                      onChange={(e) => setNewControlDescription(e.target.value)}
                      placeholder="Descripción del control"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Input
                      value={newControlType}
                      onChange={(e) => setNewControlType(e.target.value)}
                      placeholder="TEMPERATURE, CLEANING, etc."
                    />
                  </div>
                  <div>
                    <Label>Límite Crítico (opcional)</Label>
                    <Input
                      value={newControlCriticalLimit}
                      onChange={(e) => setNewControlCriticalLimit(e.target.value)}
                      placeholder="-18°C"
                    />
                  </div>
                  <div>
                    <Label>Frecuencia (opcional)</Label>
                    <Input
                      value={newControlFrequency}
                      onChange={(e) => setNewControlFrequency(e.target.value)}
                      placeholder="Diario, Semanal, etc."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreateModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateControl} disabled={isCreating}>
                      {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Crear Control
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
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar los controles APPCC. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {controls.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <Thermometer className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Sin controles APPCC</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Crea tu primer control para empezar a gestionar la seguridad alimentaria
                      </p>
                      <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Primer Control
                      </Button>
                    </Card>
                  ) : (
                    controls.map((control) => (
                      <Card key={control.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{control.name}</h3>
                              <Badge variant="outline">{control.type}</Badge>
                              {getControlStatusBadge(control.status)}
                            </div>
                            {control.description && (
                              <p className="text-sm text-muted-foreground mb-2">{control.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {control.criticalLimit && (
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Límite: {control.criticalLimit}</span>
                                </div>
                              )}
                              {control.frequency && (
                                <div className="flex items-center gap-2">
                                  <ClipboardCheck className="h-4 w-4" />
                                  <span>Frecuencia: {control.frequency}</span>
                                </div>
                              )}
                              {control.nextDueDate && (
                                <div className="flex items-center gap-2">
                                  <Info className="h-4 w-4" />
                                  <span>Próximo: {new Date(control.nextDueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span>Creado: {new Date(control.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {control.lastMeasurement && control.lastMeasurementValue && (
                              <div className="mt-3 p-3 bg-muted rounded">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">
                                    Última medición: <strong>{control.lastMeasurementValue}</strong>
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(control.lastMeasurement).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )}
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
              <h2 className="text-2xl font-bold">Mediciones</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => setIsRecordMeasurementModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Medición
                </Button>
              </div>
            </div>

            {isRecordMeasurementModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Registrar Nueva Medición</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Control</Label>
                    <Select value={selectedControlId} onValueChange={(value) => setSelectedControlId(value || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un control" />
                      </SelectTrigger>
                      <SelectContent>
                        {controls.map((control) => (
                          <SelectItem key={control.id} value={control.id}>
                            {control.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <Input
                      value={measurementValue}
                      onChange={(e) => setMeasurementValue(e.target.value)}
                      type="number"
                      step="0.1"
                      placeholder="-18.5"
                    />
                  </div>
                  <div>
                    <Label>Unidad</Label>
                    <Input
                      value={measurementUnit}
                      onChange={(e) => setMeasurementUnit(e.target.value)}
                      placeholder="°C, %, etc."
                    />
                  </div>
                  <div>
                    <Label>Notas (opcional)</Label>
                    <Textarea
                      value={measurementNotes}
                      onChange={(e) => setMeasurementNotes(e.target.value)}
                      placeholder="Observaciones sobre la medición"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsRecordMeasurementModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleRecordMeasurement} disabled={isCreating}>
                      {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Registrar Medición
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
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar las mediciones. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {measurements.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <TrendingUp className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Sin mediciones</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Registra mediciones para los controles APPCC
                      </p>
                      <Button onClick={() => setIsRecordMeasurementModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Primera Medición
                      </Button>
                    </Card>
                  ) : (
                    measurements.map((measurement) => (
                      <Card key={measurement.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">
                                {controls.find(c => c.id === measurement.controlId)?.name || 'Control desconocido'}
                              </h3>
                              <Badge variant="outline">
                                {measurement.value} {measurement.unit}
                              </Badge>
                            </div>
                            {measurement.notes && (
                              <p className="text-sm text-muted-foreground mb-2">{measurement.notes}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>Registrado: {new Date(measurement.measuredAt).toLocaleString()}</span>
                              </div>
                              {measurement.measuredBy && (
                                <div className="flex items-center gap-2">
                                  <Info className="h-4 w-4" />
                                  <span>Por: {measurement.measuredBy}</span>
                                </div>
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

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Control Sanitario APPCC</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de registro y seguimiento de controles sanitarios
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