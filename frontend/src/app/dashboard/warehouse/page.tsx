'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Warehouse,
  Package,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  AlertCircle,
  CheckCircle,
  Settings,
  ChevronRight,
  ChevronLeft,
  Download,
  Plus,
  Search,
  Filter,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

type WarehouseType = 'MAIN' | 'KITCHEN' | 'COLD_STORAGE' | 'DRY_STORAGE' | 'SPECIAL';
type EntryStatus = 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'PROCESSED';
type ExitStatus = 'PENDING' | 'APPROVED' | 'PICKED' | 'PROCESSED';
type InventoryStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';
type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | 'OVERSTOCK';
type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface WarehouseData {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  location: string;
  capacity: number;
  currentUsage: number;
  managerName: string;
  zones: number;
}

interface StockEntry {
  id: string;
  entryNumber: string;
  supplierName: string;
  receivedDate: Date;
  status: EntryStatus;
  total: number;
  itemsCount: number;
}

interface StockExit {
  id: string;
  exitNumber: string;
  exitType: string;
  requestedDate: Date;
  status: ExitStatus;
  itemsCount: number;
}

interface PhysicalInventory {
  id: string;
  inventoryNumber: string;
  inventoryType: string;
  inventoryDate: Date;
  status: InventoryStatus;
  accuracyRate: number;
  discrepancies: number;
}

interface StockAlert {
  id: string;
  productName: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  currentStock: number;
  acknowledged: boolean;
  createdAt: Date;
}

export const dynamic = 'force-dynamic';
export default function WarehousePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [exits, setExits] = useState<StockExit[]>([]);
  const [inventories, setInventories] = useState<PhysicalInventory[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [tenantId] = useState('demo-tenant');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const steps = [
    { title: 'Almacenes', icon: Warehouse },
    { title: 'Entradas', icon: ArrowDown },
    { title: 'Salidas', icon: ArrowUp },
    { title: 'Inventarios', icon: ClipboardList },
    { title: 'Alertas', icon: AlertCircle },
  ];

  useEffect(() => {
    loadData();
  }, [currentStep]);

  const loadData = async () => {
    switch (currentStep) {
      case 0:
        loadWarehouses();
        break;
      case 1:
        loadEntries();
        break;
      case 2:
        loadExits();
        break;
      case 3:
        loadInventories();
        break;
      case 4:
        loadAlerts();
        break;
    }
  };

  const loadWarehouses = async () => {
    try {
      const response = await fetch(`/api/v1/warehouses?tenantId=${tenantId}`);
      const data = await response.json();
      setWarehouses(data.map((w: any) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        type: w.type,
        location: w.location,
        capacity: w.capacity,
        currentUsage: w.capacity * 0.75,
        managerName: w.manager?.name || 'No asignado',
        zones: w._count?.zones || 0,
      })));
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
  };

  const loadEntries = async () => {
    try {
      const warehouseId = selectedWarehouse || 'demo-warehouse';
      const response = await fetch(`/api/v1/warehouses/entries?warehouseId=${warehouseId}`);
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const loadExits = async () => {
    try {
      const warehouseId = selectedWarehouse || 'demo-warehouse';
      const response = await fetch(`/api/v1/warehouses/exits?warehouseId=${warehouseId}`);
      const data = await response.json();
      setExits(data);
    } catch (error) {
      console.error('Error loading exits:', error);
    }
  };

  const loadInventories = async () => {
    try {
      const response = await fetch(`/api/v1/warehouses/inventories`);
      const data = await response.json();
      setInventories(data);
    } catch (error) {
      console.error('Error loading inventories:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await fetch(`/api/v1/warehouses/alerts?tenantId=${tenantId}`);
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
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

  const getStatusColor = (status: EntryStatus | ExitStatus | InventoryStatus) => {
    switch (status) {
      case 'PENDING':
      case 'PLANNED':
        return 'bg-yellow-500 text-white';
      case 'RECEIVED':
      case 'APPROVED':
      case 'IN_PROGRESS':
        return 'bg-blue-500 text-white';
      case 'VERIFIED':
      case 'PICKED':
        return 'bg-purple-500 text-white';
      case 'PROCESSED':
      case 'COMPLETED':
      case 'REVIEWED':
        return 'bg-green-500 text-white';
    }
  };

  const getAlertSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'INFO':
        return 'bg-blue-500 text-white';
      case 'WARNING':
        return 'bg-yellow-500 text-white';
      case 'CRITICAL':
        return 'bg-red-500 text-white';
    }
  };

  const filteredAlerts = alerts.filter(
    (alert) =>
      alert.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const usagePercentage = (currentUsage: number, capacity: number) => {
    return (currentUsage / capacity) * 100;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Almacenes</h1>
          <p className="text-muted-foreground">Control completo de inventario y stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline">
            <TrendingUp className="mr-2 h-4 w-4" />
            Reportes
          </Button>
        </div>
      </div>

      <Card className="space-y-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.title} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index <= currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs mt-2 ${
                      index <= currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar almacenes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={selectedWarehouse} onValueChange={(v) => setSelectedWarehouse(v || '')}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos los almacenes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los almacenes</SelectItem>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Almacén
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses
                  .filter((w) =>
                    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    w.code.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .map((warehouse) => (
                    <Card key={warehouse.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-5 h-5" />
                            {warehouse.name}
                          </div>
                          <Badge>{getWarehouseTypeLabel(warehouse.type)}</Badge>
                        </CardTitle>
                        <CardDescription>{warehouse.code}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ubicación:</span>
                            <span>{warehouse.location}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Capacidad:</span>
                            <span>{warehouse.capacity.toLocaleString()} unidades</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Uso actual:</span>
                            <span>{warehouse.currentUsage.toLocaleString()} unidades</span>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Porcentaje de uso</span>
                              <span>
                                {usagePercentage(warehouse.currentUsage, warehouse.capacity).toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  usagePercentage(warehouse.currentUsage, warehouse.capacity) > 90
                                    ? 'bg-red-500'
                                    : usagePercentage(warehouse.currentUsage, warehouse.capacity) > 70
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{
                                  width: `${usagePercentage(warehouse.currentUsage, warehouse.capacity)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-sm mt-3 pt-3 border-t">
                            <span className="text-muted-foreground">Responsable:</span>
                            <span>{warehouse.managerName}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Zonas:</span>
                            <span>{warehouse.zones}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <Select value={selectedWarehouse} onValueChange={(v) => setSelectedWarehouse(v || '')}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Seleccionar almacén" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Entrada
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.entryNumber}</TableCell>
                      <TableCell>{entry.supplierName}</TableCell>
                      <TableCell>{new Date(entry.receivedDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(entry.status)}>{entry.status}</Badge>
                      </TableCell>
                      <TableCell>{entry.itemsCount}</TableCell>
                      <TableCell>€{entry.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <Select value={selectedWarehouse} onValueChange={(v) => setSelectedWarehouse(v || '')}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Seleccionar almacén" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Tipo de salida" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="PRODUCTION">Producción</SelectItem>
                      <SelectItem value="TRANSFER">Transferencia</SelectItem>
                      <SelectItem value="WASTE">Merma</SelectItem>
                      <SelectItem value="RETURN">Devolución</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Salida
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exits.map((exit) => (
                    <TableRow key={exit.id}>
                      <TableCell className="font-medium">{exit.exitNumber}</TableCell>
                      <TableCell>{exit.exitType}</TableCell>
                      <TableCell>{new Date(exit.requestedDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(exit.status)}>{exit.status}</Badge>
                      </TableCell>
                      <TableCell>{exit.itemsCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <Select>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Tipo de inventario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="FULL">Completo</SelectItem>
                      <SelectItem value="PARTIAL">Parcial</SelectItem>
                      <SelectItem value="CYCLIC">Cíclico</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="PLANNED">Planificados</SelectItem>
                      <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                      <SelectItem value="COMPLETED">Completados</SelectItem>
                      <SelectItem value="REVIEWED">Revisados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Inventario
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Precisión</TableHead>
                    <TableHead>Discrepancias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventories.map((inventory) => (
                    <TableRow key={inventory.id}>
                      <TableCell className="font-medium">{inventory.inventoryNumber}</TableCell>
                      <TableCell>{inventory.inventoryType}</TableCell>
                      <TableCell>{new Date(inventory.inventoryDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(inventory.status)}>{inventory.status}</Badge>
                      </TableCell>
                      <TableCell>{inventory.accuracyRate.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            inventory.discrepancies === 0
                              ? 'bg-green-500 text-white'
                              : 'bg-yellow-500 text-white'
                          }
                        >
                          {inventory.discrepancies}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              {alerts.some((a) => !a.acknowledged && a.severity === 'CRITICAL') && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {alerts.filter((a) => !a.acknowledged && a.severity === 'CRITICAL').length}{' '}
                    alertas críticas requieren atención inmediata
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between items-center mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar alertas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button variant="outline">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Reconocer todas
                  </Button>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Generar Alertas
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAlerts.map((alert) => (
                  <Card
                    key={alert.id}
                    className={alert.acknowledged ? 'opacity-60' : ''}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{alert.productName}</span>
                        <div className="flex gap-2">
                          <Badge className={getAlertSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          {alert.acknowledged && (
                            <Badge className="bg-gray-500 text-white">Reconocido</Badge>
                          )}
                        </div>
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {new Date(alert.createdAt).toLocaleDateString()} {new Date(alert.createdAt).toLocaleTimeString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm">{alert.message}</p>
                        <div className="flex justify-between text-sm pt-2 border-t">
                          <span className="text-muted-foreground">Stock actual:</span>
                          <span className="font-medium">{alert.currentStock}</span>
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <Button className="mt-4 w-full" variant="outline" size="sm">
                          Reconocer
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            <Button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={currentStep === steps.length - 1}
            >
              {currentStep === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
              {currentStep < steps.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}