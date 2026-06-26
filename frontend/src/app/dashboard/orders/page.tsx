'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useOrders, type OrderResponse } from '@/hooks/use-orders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: orders, isLoading, error, refetch, createOrder, updateOrder, isCreating } = useOrders();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newOrderNumber, setNewOrderNumber] = useState('');
  const [newOrderCover, setNewOrderCover] = useState('');
  const [newOrderEstimatedTime, setNewOrderEstimatedTime] = useState('');

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

  const handleCreateOrder = async () => {
    if (!newOrderNumber.trim()) return;

    try {
      await createOrder({
        orderNumber: newOrderNumber,
        cover: newOrderCover || undefined,
        estimatedTime: newOrderEstimatedTime || undefined,
      });
      setIsCreateModalOpen(false);
      setNewOrderNumber('');
      setNewOrderCover('');
      setNewOrderEstimatedTime('');
      refetch();
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const handleUpdateOrder = async (id: string) => {
    if (!newOrderNumber.trim()) return;

    try {
      await updateOrder({
        id,
        data: {
          orderNumber: newOrderNumber,
          cover: newOrderCover || undefined,
          estimatedTime: newOrderEstimatedTime || undefined,
        },
      });
      setIsEditMode(false);
      setEditingOrderId('');
      setNewOrderNumber('');
      setNewOrderCover('');
      setNewOrderEstimatedTime('');
      setIsCreateModalOpen(false);
      refetch();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const startEditOrder = (order: OrderResponse) => {
    setEditingOrderId(order.id);
    setNewOrderNumber(order.orderNumber);
    setNewOrderCover(order.cover || '');
    setNewOrderEstimatedTime(order.estimatedTime || '');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleEditClose = () => {
    setIsEditMode(false);
    setEditingOrderId('');
    setNewOrderNumber('');
    setNewOrderCover('');
    setNewOrderEstimatedTime('');
    setIsCreateModalOpen(false);
  };

  const filteredOrders = (orders || []).filter(order =>
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
    const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      preparing: { label: 'Preparando', variant: 'default' },
      ready: { label: 'Listo', variant: 'default' },
      served: { label: 'Servido', variant: 'outline' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
    };
    const config = statusConfig[status.toLowerCase()] || { label: status, variant: 'secondary' as BadgeVariant };
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Pedidos</h1>
        <p className="text-muted-foreground mt-1">
          Sistema completo de gestión de órdenes y pedidos
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Gestión de Pedidos</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Pedido
            </Button>
          </div>
        </div>

        {isCreateModalOpen && (
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{isEditMode ? 'Editar Pedido' : 'Crear Nuevo Pedido'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Número de Pedido</Label>
                <Input
                  value={newOrderNumber}
                  onChange={(e) => setNewOrderNumber(e.target.value)}
                  placeholder="ORD-001"
                />
              </div>
              <div>
                <Label>Cubiertos</Label>
                <Input
                  value={newOrderCover}
                  onChange={(e) => setNewOrderCover(e.target.value)}
                  placeholder="2"
                />
              </div>
              <div>
                <Label>Tiempo Estimado (minutos)</Label>
                <Input
                  value={newOrderEstimatedTime}
                  onChange={(e) => setNewOrderEstimatedTime(e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleEditClose()} variant="outline">
                  Cancelar
                </Button>
                <Button
                  onClick={() => isEditMode ? handleUpdateOrder(editingOrderId) : handleCreateOrder()}
                  disabled={isCreating}
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isEditMode ? 'Guardar Cambios' : 'Crear Pedido'}
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
              No se pudieron cargar los pedidos. Por favor intenta nuevamente.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            {filteredOrders.length === 0 ? (
              <Card className="p-12 flex flex-col items-center justify-center">
                <Clock className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'No se encontraron resultados' : 'Sin pedidos'}
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  {searchQuery
                    ? 'Prueba con otros términos de búsqueda'
                    : 'Crea tu primer pedido para empezar a gestionar las órdenes'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primer Pedido
                  </Button>
                )}
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cubiertos</TableHead>
                    <TableHead>Tiempo Estimado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.cover || '-'}</TableCell>
                      <TableCell>{order.estimatedTime || '-'}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{new Date(order.orderDate || order.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => startEditOrder(order)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}