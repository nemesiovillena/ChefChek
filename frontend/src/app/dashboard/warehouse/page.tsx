'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useWarehouse } from '@/hooks/use-warehouse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Warehouse,
  Package,
  ArrowDown,
  ArrowUp,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Trash2,
} from 'lucide-react';

type WarehouseType = 'MAIN' | 'KITCHEN' | 'COLD_STORAGE' | 'DRY_STORAGE' | 'SPECIAL';

export const dynamic = 'force-dynamic';
export default function WarehousePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    warehouses,
    stockMovements,
    isLoading,
    error,
    refetch,
    createWarehouse,
    createStockMovement,
    isCreating,
  } = useWarehouse();

  const [currentStep, setCurrentStep] = useState(0);
  const [isCreateWarehouseModalOpen, setIsCreateWarehouseModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseType, setNewWarehouseType] = useState<WarehouseType>('MAIN');
  const [newWarehouseCapacity, setNewWarehouseCapacity] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementReason, setMovementReason] = useState('');

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
    { title: 'Almacenes', icon: Warehouse },
    { title: 'Movimientos', icon: Package },
  ];

  const handleCreateWarehouse = async () => {
    if (!newWarehouseName.trim()) return;

    try {
      await createWarehouse({
        name: newWarehouseName,
        type: newWarehouseType,
        capacity: newWarehouseCapacity ? parseInt(newWarehouseCapacity) : undefined,
      });
      setIsCreateWarehouseModalOpen(false);
      setNewWarehouseName('');
      setNewWarehouseType('MAIN');
      setNewWarehouseCapacity('');
      refetch();
    } catch (error) {
      console.error('Error creating warehouse:', error);
    }
  };

  const handleCreateStockMovement = async () => {
    if (!selectedWarehouseId || !movementQuantity.trim()) return;

    try {
      await createStockMovement({
        warehouseId: selectedWarehouseId,
        movementType,
        quantity: parseInt(movementQuantity),
        reason: movementReason || undefined,
      });
      setIsMovementModalOpen(false);
      setSelectedWarehouseId('');
      setMovementType('IN');
      setMovementQuantity('');
      setMovementReason('');
      refetch();
    } catch (error) {
      console.error('Error creating stock movement:', error);
    }
  };

  const getWarehouseTypeLabel = (type: WarehouseType) => {
    const labels = {
      MAIN: 'Principal',
      KITCHEN: 'Cocina',
      COLD_STORAGE: 'Frío',
      DRY_STORAGE: 'Secos',
      SPECIAL: 'Especial',
    };
    return labels[type] || type;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gestión de Almacenes</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => setIsCreateWarehouseModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Almacén
                </Button>
              </div>
            </div>

            {isCreateWarehouseModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Crear Nuevo Almacén</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={newWarehouseName}
                      onChange={(e) => setNewWarehouseName(e.target.value)}
                      placeholder="Nombre del almacén"
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={newWarehouseType} onValueChange={(value) => setNewWarehouseType(value as WarehouseType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MAIN">Principal</SelectItem>
                        <SelectItem value="KITCHEN">Cocina</SelectItem>
                        <SelectItem value="COLD_STORAGE">Frío</SelectItem>
                        <SelectItem value="DRY_STORAGE">Secos</SelectItem>
                        <SelectItem value="SPECIAL">Especial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Capacidad (opcional)</Label>
                    <Input
                      value={newWarehouseCapacity}
                      onChange={(e) => setNewWarehouseCapacity(e.target.value)}
                      type="number"
                      placeholder="Capacidad en unidades"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreateWarehouseModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateWarehouse} disabled={isCreating}>
                      {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Crear Almacén
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
                  No se pudieron cargar los almacenes. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="grid gap-4">
                  {warehouses.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center">
                      <Warehouse className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Sin almacenes</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Crea tu primer almacén para empezar a gestionar el inventario
                      </p>
                      <Button onClick={() => setIsCreateWarehouseModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Primer Almacén
                      </Button>
                    </Card>
                  ) : (
                    warehouses.map((warehouse) => (
                      <Card key={warehouse.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div
                              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                warehouse.isActive
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-gray-500/10 text-gray-500'
                              }`}
                            >
                              <Warehouse className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold">{warehouse.name}</h3>
                                <Badge variant={warehouse.isActive ? 'default' : 'secondary'}>
                                  {warehouse.isActive ? 'Activo' : 'Inactivo'}
                                </Badge>
                                <Badge variant="outline">
                                  {getWarehouseTypeLabel(warehouse.type)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                {warehouse.capacity && (
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span>Capacidad: {warehouse.capacity}</span>
                                  </div>
                                )}
                                {warehouse.currentStock !== undefined && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Stock actual: {warehouse.currentStock}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Creado: {new Date(warehouse.createdAt).toLocaleDateString()}</span>
                                </div>
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
              <h2 className="text-2xl font-bold">Movimientos de Stock</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => setIsMovementModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Movimiento
                </Button>
              </div>
            </div>

            {isMovementModalOpen && (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Registrar Movimiento de Stock</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Almacén</Label>
                    <Select value={selectedWarehouseId} onValueChange={(value) => setSelectedWarehouseId(value || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un almacén" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Movimiento</Label>
                    <Select value={movementType} onValueChange={(value) => setMovementType(value as 'IN' | 'OUT')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-4 w-4" />
                            Entrada
                          </div>
                        </SelectItem>
                        <SelectItem value="OUT">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4" />
                            Salida
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input
                      value={movementQuantity}
                      onChange={(e) => setMovementQuantity(e.target.value)}
                      type="number"
                      placeholder="Cantidad de unidades"
                    />
                  </div>
                  <div>
                    <Label>Razón (opcional)</Label>
                    <Input
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      placeholder="Razón del movimiento"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsMovementModalOpen(false)} variant="outline">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateStockMovement} disabled={isCreating}>
                      {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Registrar Movimiento
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
                  No se pudieron cargar los movimientos de stock. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[calc(100vh-350px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Razón</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Sin movimientos de stock</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {new Date(movement.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {warehouses.find(w => w.id === movement.warehouseId)?.name || 'Desconocido'}
                          </TableCell>
                          <TableCell>
                            {movement.productName || 'General'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={movement.movementType === 'IN' ? 'default' : 'destructive'}
                              className={movement.movementType === 'IN' ? 'bg-green-500' : 'bg-red-500'}
                            >
                              {movement.movementType === 'IN' ? (
                                <>
                                  <ArrowDown className="mr-1 h-3 w-3" />
                                  Entrada
                                </>
                              ) : (
                                <>
                                  <ArrowUp className="mr-1 h-3 w-3" />
                                  Salida
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>{movement.quantity}</TableCell>
                          <TableCell>{movement.reason || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
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
        <h1 className="text-3xl font-bold">Gestión de Almacenes</h1>
        <p className="text-muted-foreground mt-1">
          Control completo de inventario y movimientos de stock
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