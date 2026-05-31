'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Download, Send, CheckCircle, Clock, FileText, Package, Filter, TrendingUp } from 'lucide-react';

type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type OrderStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SENT' | 'RECEIVED' | 'CANCELLED';
type ConservationZone = 'FROZEN' | 'REFRIGERATED' | 'DRY_GOODS' | 'AMBIENT' | 'SPECIAL';

interface OrderRequirement {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minimumStock: number;
  projectedConsumption: number;
  requiredQuantity: number;
  suggestedQuantity: number;
  urgency: Urgency;
  supplierId: string;
  supplierName: string;
  conservationZone: string;
  category: string;
  unit: string;
  estimatedCost: number;
  averageDailyConsumption: number;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  adjustedQuantity?: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  notes?: string;
}

interface AutomatedOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  status: OrderStatus;
  urgency: Urgency;
  scheduledDelivery?: Date;
  estimatedCost: number;
  createdAt: Date;
  items: OrderItem[];
}

export default function OrdersPage() {
  const [requirements, setRequirements] = useState<OrderRequirement[]>([]);
  const [orders, setOrders] = useState<AutomatedOrder[]>([]);
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set());
  const [tenantId] = useState('demo-tenant');
  const [loading, setLoading] = useState(false);
  const [historicalPeriod, setHistoricalPeriod] = useState(7);
  const [lookaheadDays, setLookaheadDays] = useState(7);
  const [filterUrgency, setFilterUrgency] = useState<Urgency | 'ALL'>('ALL');
  const [filterZone, setFilterZone] = useState<ConservationZone | 'ALL'>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('');

  useEffect(() => {
    calculateRequirements();
    loadOrdersHistory();
  }, []);

  const calculateRequirements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/orders/calculate-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, historicalPeriod, lookaheadDays }),
      });
      const data = await response.json();
      setRequirements(data);
    } catch (error) {
      console.error('Error calculating requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrdersHistory = async () => {
    try {
      const response = await fetch(`/api/v1/orders/history?tenantId=${tenantId}`);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const toggleRequirementSelection = (id: string) => {
    const newSelection = new Set(selectedRequirements);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRequirements(newSelection);
  };

  const createOrderFromSelected = async () => {
    if (selectedRequirements.size === 0) return;

    const selectedItems = requirements.filter((req) =>
      selectedRequirements.has(req.id),
    );

    const supplierGroups = selectedItems.reduce((acc, item) => {
      if (!acc[item.supplierId]) {
        acc[item.supplierId] = [];
      }
      acc[item.supplierId].push(item);
      return acc;
    }, {} as Record<string, OrderRequirement[]>);

    for (const [supplierId, items] of Object.entries(supplierGroups)) {
      try {
        await fetch('/api/v1/orders/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            supplierId,
            urgency: items.some((i) => i.urgency === 'CRITICAL')
              ? 'CRITICAL'
              : items.some((i) => i.urgency === 'HIGH')
              ? 'HIGH'
              : 'MEDIUM',
            items: items.map((item) => ({
              productId: item.productId,
              requestedQuantity: item.suggestedQuantity,
              unitPrice: item.estimatedCost / item.suggestedQuantity,
            })),
          }),
        });
      } catch (error) {
        console.error('Error creating order:', error);
      }
    }

    loadOrdersHistory();
    setSelectedRequirements(new Set());
  };

  const approveOrder = async (orderId: string) => {
    try {
      await fetch(`/api/v1/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'current-user' }),
      });
      loadOrdersHistory();
    } catch (error) {
      console.error('Error approving order:', error);
    }
  };

  const sendOrder = async (orderId: string) => {
    try {
      await fetch(`/api/v1/orders/${orderId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentBy: 'current-user' }),
      });
      loadOrdersHistory();
    } catch (error) {
      console.error('Error sending order:', error);
    }
  };

  const exportOrder = async (orderId: string, format: 'PDF' | 'EXCEL') => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/export/${format}`);
      const data = await response.json();
      console.log('Exported template:', data);
    } catch (error) {
      console.error('Error exporting order:', error);
    }
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'CRITICAL':
        return 'bg-red-500 text-white';
      case 'HIGH':
        return 'bg-orange-500 text-white';
      case 'MEDIUM':
        return 'bg-yellow-500 text-white';
      case 'LOW':
        return 'bg-green-500 text-white';
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-500 text-white';
      case 'REVIEW':
        return 'bg-blue-500 text-white';
      case 'APPROVED':
        return 'bg-purple-500 text-white';
      case 'SENT':
        return 'bg-indigo-500 text-white';
      case 'RECEIVED':
        return 'bg-green-500 text-white';
      case 'CANCELLED':
        return 'bg-red-500 text-white';
    }
  };

  const filteredRequirements = requirements.filter((req) => {
    if (filterUrgency !== 'ALL' && req.urgency !== filterUrgency) return false;
    if (filterZone !== 'ALL' && req.conservationZone !== filterZone) return false;
    if (selectedSupplier && req.supplierId !== selectedSupplier) return false;
    return true;
  });

  const groupedRequirements = filteredRequirements.reduce((acc, req) => {
    if (!acc[req.supplierId]) {
      acc[req.supplierId] = [];
    }
    acc[req.supplierId].push(req);
    return acc;
  }, {} as Record<string, OrderRequirement[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Hojas de Pedido Automatizadas</h1>
          <p className="text-muted-foreground">Sistema inteligente de generación de pedidos</p>
        </div>
        <Button onClick={calculateRequirements} disabled={loading}>
          <TrendingUp className="mr-2 h-4 w-4" />
          Recalcular Necesidades
        </Button>
      </div>

      <Tabs defaultValue="requirements" className="space-y-6">
        <TabsList>
          <TabsTrigger value="requirements">
            <Package className="mr-2 h-4 w-4" />
            Necesidades
          </TabsTrigger>
          <TabsTrigger value="supplier">
            <Filter className="mr-2 h-4 w-4" />
            Por Proveedor
          </TabsTrigger>
          <TabsTrigger value="zone">
            <AlertCircle className="mr-2 h-4 w-4" />
            Por Zona
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="mr-2 h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Cálculo</CardTitle>
              <CardDescription>
                Ajusta los parámetros para calcular las necesidades de pedido
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="historical-period">Período Histórico (días)</Label>
                <Input
                  id="historical-period"
                  type="number"
                  value={historicalPeriod}
                  onChange={(e) => setHistoricalPeriod(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lookahead-days">Días de Proyección</Label>
                <Input
                  id="lookahead-days"
                  type="number"
                  value={lookaheadDays}
                  onChange={(e) => setLookaheadDays(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {requirements.some((req) => req.urgency === 'CRITICAL') && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {requirements.filter((req) => req.urgency === 'CRITICAL').length} productos
                requieren atención CRÍTICA inmediata
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4">
              <Select value={filterUrgency} onValueChange={(v: any) => setFilterUrgency(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Urgencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="CRITICAL">Crítica</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="LOW">Baja</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterZone} onValueChange={(v: any) => setFilterZone(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="FROZEN">Congelado</SelectItem>
                  <SelectItem value="REFRIGERATED">Refrigerado</SelectItem>
                  <SelectItem value="DRY_GOODS">Secos</SelectItem>
                  <SelectItem value="AMBIENT">Ambiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRequirements.size > 0 && (
              <Button onClick={createOrderFromSelected}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Pedido ({selectedRequirements.size} items)
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>Stock Mínimo</TableHead>
                <TableHead>Consumo Diario</TableHead>
                <TableHead>Proyectado</TableHead>
                <TableHead>Sugerido</TableHead>
                <TableHead>Urgencia</TableHead>
                <TableHead>Costo Est.</TableHead>
                <TableHead>Proveedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequirements.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRequirements.has(req.id)}
                      onChange={() => toggleRequirementSelection(req.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{req.productName}</TableCell>
                  <TableCell>{req.currentStock}</TableCell>
                  <TableCell>{req.minimumStock}</TableCell>
                  <TableCell>{req.averageDailyConsumption.toFixed(2)}</TableCell>
                  <TableCell>{req.projectedConsumption.toFixed(0)}</TableCell>
                  <TableCell>{req.suggestedQuantity.toFixed(0)}</TableCell>
                  <TableCell>
                    <Badge className={getUrgencyColor(req.urgency)}>{req.urgency}</Badge>
                  </TableCell>
                  <TableCell>€{req.estimatedCost.toFixed(2)}</TableCell>
                  <TableCell>{req.supplierName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="supplier" className="space-y-6">
          {Object.entries(groupedRequirements).map(([supplierId, items]) => (
            <Card key={supplierId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{items[0].supplierName}</span>
                  <Badge>{items.length} productos</Badge>
                </CardTitle>
                <CardDescription>
                  Total estimado: €{items.reduce((sum, item) => sum + item.estimatedCost, 0).toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Sugerido</TableHead>
                      <TableHead>Urgencia</TableHead>
                      <TableHead>Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.conservationZone}</TableCell>
                        <TableCell>{item.suggestedQuantity.toFixed(0)}</TableCell>
                        <TableCell>
                          <Badge className={getUrgencyColor(item.urgency)}>{item.urgency}</Badge>
                        </TableCell>
                        <TableCell>€{item.estimatedCost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="zone" className="space-y-6">
          {(['FROZEN', 'REFRIGERATED', 'DRY_GOODS', 'AMBIENT'] as ConservationZone[]).map(
            (zone) => {
              const zoneItems = filteredRequirements.filter((req) => req.conservationZone === zone);
              if (zoneItems.length === 0) return null;

              return (
                <Card key={zone}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{zone.replace('_', ' ')}</span>
                      <Badge>{zoneItems.length} productos</Badge>
                    </CardTitle>
                    <CardDescription>
                      Total estimado: €
                      {zoneItems.reduce((sum, item) => sum + item.estimatedCost, 0).toFixed(2)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Sugerido</TableHead>
                          <TableHead>Urgencia</TableHead>
                          <TableHead>Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zoneItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.supplierName}</TableCell>
                            <TableCell>{item.suggestedQuantity.toFixed(0)}</TableCell>
                            <TableCell>
                              <Badge className={getUrgencyColor(item.urgency)}>{item.urgency}</Badge>
                            </TableCell>
                            <TableCell>€{item.estimatedCost.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            },
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {orders.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No hay pedidos generados aún</AlertDescription>
            </Alert>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {order.orderNumber}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      <Badge className={getUrgencyColor(order.urgency)}>{order.urgency}</Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Proveedor: {order.supplierName} | Total: €{order.estimatedCost.toFixed(2)} |{' '}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Ajustado</TableHead>
                        <TableHead>Precio Unit.</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.requestedQuantity}</TableCell>
                          <TableCell>{item.adjustedQuantity || '-'}</TableCell>
                          <TableCell>€{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>€{item.totalCost.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex gap-2 mt-4">
                    {order.status === 'DRAFT' || order.status === 'REVIEW' ? (
                      <Button onClick={() => approveOrder(order.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Aprobar
                      </Button>
                    ) : null}
                    {order.status === 'APPROVED' ? (
                      <Button onClick={() => sendOrder(order.id)}>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={() => exportOrder(order.id, 'PDF')}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Button variant="outline" onClick={() => exportOrder(order.id, 'EXCEL')}>
                      <Download className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}