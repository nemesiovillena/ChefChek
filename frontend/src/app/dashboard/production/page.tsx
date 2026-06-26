'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useProduction } from '@/hooks/use-production';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Factory,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Loader2,
  Package,
  Calendar,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ProductionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { batches, workOrders, isLoading, error, refetch, createBatch } = useProduction();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDescription, setNewBatchDescription] = useState('');
  const [newBatchPlannedDate, setNewBatchPlannedDate] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const steps = [
    { title: 'Lotes', icon: Factory },
    { title: 'Órdenes de Trabajo', icon: Package },
  ];

  const handleCreateBatch = async () => {
    if (!newBatchName.trim() || !newBatchPlannedDate.trim()) return;

    try {
      await createBatch({
        name: newBatchName,
        description: newBatchDescription || undefined,
        plannedDate: newBatchPlannedDate,
      });
      setIsCreateBatchModalOpen(false);
      setNewBatchName('');
      setNewBatchDescription('');
      setNewBatchPlannedDate('');
      refetch();
    } catch (error) {
      console.error('Error creating batch:', error);
    }
  };

  const getBatchStatusBadge = (status: string) => {
    type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
    const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      in_progress: { label: 'En Progreso', variant: 'default' },
      completed: { label: 'Completado', variant: 'default' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
    };
    const config = statusConfig[status.toLowerCase()] || { label: status, variant: 'secondary' as BadgeVariant };
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const getWorkOrderStatusBadge = (status: string) => {
    type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
    const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      preparing: { label: 'Preparando', variant: 'default' },
      cooking: { label: 'Cocinando', variant: 'default' },
      ready: { label: 'Listo', variant: 'default' },
      served: { label: 'Servido', variant: 'outline' },
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
              <h2 className="text-2xl font-bold">Gestión de Lotes de Producción</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => setIsCreateBatchModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Lote
                </Button>
              </div>
            </div>

            {isCreateBatchModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Crear Nuevo Lote de Producción</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nombre del Lote</Label>
                    <Input
                      value={newBatchName}
                      onChange={(e) => setNewBatchName(e.target.value)}
                      placeholder="Lote del día 2025-06-08"
                    />
                  </div>
                  <div>
                    <Label>Descripción (opcional)</Label>
                    <Textarea
                      value={newBatchDescription}
                      onChange={(e) => setNewBatchDescription(e.target.value)}
                      placeholder="Descripción del lote de producción"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Fecha Programada</Label>
                    <Input
                      value={newBatchPlannedDate}
                      onChange={(e) => setNewBatchPlannedDate(e.target.value)}
                      type="date"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreateBatchModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateBatch}>
                      Crear Lote
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
                  No se pudieron cargar los lotes de producción. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {batches.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <Factory className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Sin lotes de producción</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Crea tu primer lote para empezar a gestionar la producción
                      </p>
                      <Button onClick={() => setIsCreateBatchModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Primer Lote
                      </Button>
                    </Card>
                  ) : (
                    batches.map((batch) => (
                      <Card key={batch.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{batch.name}</h3>
                              <Badge variant="outline">
                                <Clock className="mr-1 h-3 w-3" />
                                {new Date(batch.plannedDate).toLocaleDateString()}
                              </Badge>
                              {getBatchStatusBadge(batch.status)}
                            </div>
                            {batch.description && (
                              <p className="text-sm text-muted-foreground mb-2">{batch.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Creado: {new Date(batch.createdAt).toLocaleDateString()}</span>
                              </div>
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
              <h2 className="text-2xl font-bold">Órdenes de Trabajo</h2>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar las órdenes de trabajo. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {workOrders.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Sin órdenes de trabajo</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Las órdenes de trabajo aparecerán aquí cuando se creen lotes de producción
                      </p>
                    </Card>
                  ) : (
                    workOrders.map((order) => (
                      <Card key={order.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">
                                {order.recipeName || 'Sin receta asignada'}
                              </h3>
                              {getWorkOrderStatusBadge(order.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                <span>Cantidad: {order.quantity}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>Estado: {getWorkOrderStatusBadge(order.status).props.children}</span>
                              </div>
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
        <h1 className="text-3xl font-bold">Gestión de Producción</h1>
        <p className="text-muted-foreground mt-1">
          Sistema completo de gestión de lotes y órdenes de trabajo
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