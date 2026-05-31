'use client';

import { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Factory,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  TrendingUp,
  Calendar,
  MapPin,
  Plus,
  Search,
  Filter,
} from 'lucide-react';

interface WorkBatch {
  id: string;
  name: string;
  description?: string;
  scheduledDate: Date;
  scheduledTime: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  responsible: string[];
  kitchenZone: string;
  productionOrders: ProductionOrder[];
  startedAt?: Date;
  completedAt?: Date;
}

interface ProductionOrder {
  id: string;
  batchId: string;
  recipeId: string;
  recipeName: string;
  quantity: number;
  unit: string;
  estimatedTime: number;
  actualTime?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  miseEnPlaceItems: MiseEnPlaceItem[];
}

interface MiseEnPlaceItem {
  id: string;
  orderId: string;
  description: string;
  quantity: number;
  unit: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'VERIFIED';
  notes?: string;
  completedAt?: Date;
}

interface TaskAssignment {
  id: string;
  batchId: string;
  orderId: string;
  taskId: string;
  assignedTo: string;
  taskType: 'PREPARATION' | 'COOKING' | 'PLATING' | 'QUALITY_CHECK';
  estimatedTime: number;
  actualTime?: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
}

interface ProgressTracking {
  orderId: string;
  overallProgress: number;
  timeElapsed: number;
  timeRemaining: number;
  status: 'ON_SCHEDULE' | 'DELAYED' | 'AHEAD' | 'CRITICAL';
  milestones: Milestone[];
  alerts: ProductionAlert[];
}

interface Milestone {
  id: string;
  orderId: string;
  name: string;
  scheduledTime: Date;
  actualTime?: Date;
  status: 'PENDING' | 'ACHIEVED' | 'DELAYED' | 'SKIPPED';
}

interface ProductionAlert {
  id: string;
  orderId: string;
  type: 'DELAY' | 'QUALITY' | 'STAFFING' | 'EQUIPMENT' | 'INGREDIENTS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
}

interface ProductionKPI {
  completionRate: number;
  efficiency: number;
  onTimeDelivery: number;
  staffUtilization: number;
  avgTaskDuration: number;
  alertCount: number;
}

export default function ProductionPage() {
  const [activeTab, setActiveTab] = useState('batches');

  // Work Batches State
  const [workBatches, setWorkBatches] = useState<WorkBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<WorkBatch | null>(null);
  const [newBatch, setNewBatch] = useState({
    name: '',
    description: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    priority: 'MEDIUM' as const,
    responsible: [] as string[],
    kitchenZone: 'HOT_KITCHEN' as const,
  });

  // Production Orders State
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Progress Tracking State
  const [progressTracking, setProgressTracking] = useState<ProgressTracking | null>(null);

  // Task Assignments State
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([]);
  const [newTask, setNewTask] = useState({
    assignedTo: '',
    taskType: 'PREPARATION' as const,
    estimatedTime: 30,
  });

  // Alerts State
  const [alerts, setAlerts] = useState<ProductionAlert[]>([]);

  // Reports State
  const [productionKPIs, setProductionKPIs] = useState<ProductionKPI | null>(null);
  const [reportPeriod, setReportPeriod] = useState('today');

  useEffect(() => {
    loadWorkBatches();
    loadTaskAssignments();
    loadAlerts();
  }, []);

  const loadWorkBatches = async () => {
    // Mock data - replace with API call
    setWorkBatches([
      {
        id: '1',
        name: 'Producción Almuerzo - Lunes',
        description: 'Preparación completa para servicio de almuerzo',
        scheduledDate: new Date('2026-06-01'),
        scheduledTime: '08:00',
        status: 'PENDING',
        priority: 'HIGH',
        responsible: ['Juan', 'María'],
        kitchenZone: 'HOT_KITCHEN',
        productionOrders: [],
      },
      {
        id: '2',
        name: 'Producción Pastelería - Semanal',
        description: 'Producción de pasteles y postres para la semana',
        scheduledDate: new Date('2026-05-31'),
        scheduledTime: '06:00',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        responsible: ['Ana'],
        kitchenZone: 'PASTRY_KITCHEN',
        productionOrders: [],
        startedAt: new Date(),
      },
    ]);
  };

  const handleCreateBatch = async () => {
    const batch: WorkBatch = {
      id: Date.now().toString(),
      ...newBatch,
      productionOrders: [],
    };

    setWorkBatches([batch, ...workBatches]);
    setNewBatch({
      name: '',
      description: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '09:00',
      priority: 'MEDIUM',
      responsible: [],
      kitchenZone: 'HOT_KITCHEN',
    });
  };

  const handleStartBatch = async (batchId: string) => {
    setWorkBatches(
      workBatches.map((b) =>
        b.id === batchId ? { ...b, status: 'IN_PROGRESS' as const, startedAt: new Date() } : b
      )
    );
  };

  const handleCompleteBatch = async (batchId: string) => {
    setWorkBatches(
      workBatches.map((b) =>
        b.id === batchId ? { ...b, status: 'COMPLETED' as const, completedAt: new Date() } : b
      )
    );
  };

  const loadProgressTracking = async (orderId: string) => {
    // Mock data - replace with API call
    setProgressTracking({
      orderId,
      overallProgress: 45,
      timeElapsed: 27,
      timeRemaining: 33,
      status: 'ON_SCHEDULE',
      milestones: [
        {
          id: '1',
          orderId,
          name: 'Mise en place',
          scheduledTime: new Date(Date.now() - 60 * 1000),
          actualTime: new Date(Date.now() - 60 * 1000),
          status: 'ACHIEVED',
        },
        {
          id: '2',
          orderId,
          name: 'Preparation',
          scheduledTime: new Date(Date.now() + 20 * 60 * 1000),
          status: 'IN_PROGRESS',
        },
        {
          id: '3',
          orderId,
          name: 'Cooking',
          scheduledTime: new Date(Date.now() + 35 * 60 * 1000),
          status: 'PENDING',
        },
      ],
      alerts: [],
    });
  };

  const loadTaskAssignments = async () => {
    // Mock data - replace with API call
    setTaskAssignments([
      {
        id: '1',
        batchId: '2',
        orderId: '1',
        taskId: 't1',
        assignedTo: 'Ana',
        taskType: 'PREPARATION',
        estimatedTime: 45,
        actualTime: 40,
        status: 'IN_PROGRESS',
      },
      {
        id: '2',
        batchId: '2',
        orderId: '1',
        taskId: 't2',
        assignedTo: 'Juan',
        taskType: 'COOKING',
        estimatedTime: 60,
        status: 'ASSIGNED',
      },
    ]);
  };

  const loadAlerts = async () => {
    // Mock data - replace with API call
    setAlerts([
      {
        id: '1',
        orderId: '1',
        type: 'DELAY',
        severity: 'MEDIUM',
        message: 'Preparación está 10 minutos retrasada',
        createdAt: new Date(),
      },
    ]);
  };

  const handleGenerateReport = async () => {
    // Mock data - replace with API call
    setProductionKPIs({
      completionRate: 92,
      efficiency: 88,
      onTimeDelivery: 85,
      staffUtilization: 95,
      avgTaskDuration: 42,
      alertCount: 3,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'READY':
      case 'VERIFIED':
      case 'ACHIEVED':
        return 'bg-green-500';
      case 'IN_PROGRESS':
        return 'bg-blue-500';
      case 'PENDING':
      case 'ASSIGNED':
        return 'bg-yellow-500';
      case 'CANCELLED':
      case 'ON_HOLD':
      case 'DELAYED':
        return 'bg-orange-500';
      case 'CRITICAL':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-500';
      case 'MEDIUM':
        return 'bg-blue-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'URGENT':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'ON_SCHEDULE':
        return 'bg-green-500';
      case 'AHEAD':
        return 'bg-blue-500';
      case 'DELAYED':
        return 'bg-yellow-500';
      case 'CRITICAL':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Control de Producción</h1>
          <p className="text-muted-foreground">
            Sistema de gestión de partidas de trabajo y mise en place
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="batches">
            <Factory className="mr-2 h-4 w-4" />
            Partidas
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Clock className="mr-2 h-4 w-4" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <Users className="mr-2 h-4 w-4" />
            Tareas
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertCircle className="mr-2 h-4 w-4" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="reports">
            <TrendingUp className="mr-2 h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        {/* Work Batches */}
        <TabsContent value="batches" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Nueva Partida de Trabajo
                </CardTitle>
                <CardDescription>
                  Crea una nueva partida de producción
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Producción Almuerzo - Lunes"
                    value={newBatch.name}
                    onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descripción de la partida"
                    value={newBatch.description}
                    onChange={(e) => setNewBatch({ ...newBatch, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newBatch.scheduledDate}
                      onChange={(e) => setNewBatch({ ...newBatch, scheduledDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Hora</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newBatch.scheduledTime}
                      onChange={(e) => setNewBatch({ ...newBatch, scheduledTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select
                    value={newBatch.priority}
                    onValueChange={(value) => setNewBatch({ ...newBatch, priority: value as any })}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="zone">Zona de Cocina</Label>
                  <Select
                    value={newBatch.kitchenZone}
                    onValueChange={(value) => setNewBatch({ ...newBatch, kitchenZone: value as any })}
                  >
                    <SelectTrigger id="zone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOT_KITCHEN">Cocinado Caliente</SelectItem>
                      <SelectItem value="COLD_KITCHEN">Preparación Fría</SelectItem>
                      <SelectItem value="PASTRY_KITCHEN">Pastelería</SelectItem>
                      <SelectItem value="GRILL_STATION">Parrilla</SelectItem>
                      <SelectItem value="FRYING_STATION">Freidora</SelectItem>
                      <SelectItem value="PLATING_STATION">Emplatado</SelectItem>
                      <SelectItem value="SERVICE_STATION">Servicio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateBatch} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Partida
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  Partidas de Trabajo
                </CardTitle>
                <CardDescription>
                  Lista de partidas programadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workBatches.map((batch) => (
                    <div
                      key={batch.id}
                      onClick={() => setSelectedBatch(batch)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedBatch?.id === batch.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{batch.name}</p>
                            <Badge className={getStatusColor(batch.status)}>
                              {batch.status}
                            </Badge>
                            <Badge className={getPriorityColor(batch.priority)}>
                              {batch.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm opacity-80">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(batch.scheduledDate).toLocaleDateString('es-ES')} - {batch.scheduledTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm opacity-80 mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{batch.kitchenZone}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {batch.status === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartBatch(batch.id);
                              }}
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Iniciar
                            </Button>
                          )}
                          {batch.status === 'IN_PROGRESS' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteBatch(batch.id);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Completar
                            </Button>
                          )}
                        </div>
                      </div>
                      {batch.responsible.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {batch.responsible.map((resp, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {resp}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedBatch && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle de Partida</CardTitle>
                <CardDescription>{selectedBatch.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <Badge className={getStatusColor(selectedBatch.status)}>
                      {selectedBatch.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prioridad</p>
                    <Badge className={getPriorityColor(selectedBatch.priority)}>
                      {selectedBatch.priority}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Zona</p>
                    <p className="font-medium">{selectedBatch.kitchenZone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Responsables</p>
                    <div className="flex gap-1">
                      {selectedBatch.responsible.map((resp, idx) => (
                        <Badge key={idx} variant="secondary">
                          {resp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Production Orders */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Órdenes de Producción
              </CardTitle>
              <CardDescription>
                Gestiona las órdenes de producción
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecciona una partida de trabajo para ver sus órdenes</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Task Assignments */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Asignación de Tareas
              </CardTitle>
              <CardDescription>
                Distribuye tareas entre el personal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {taskAssignments.map((assignment) => (
                  <div key={assignment.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status}
                          </Badge>
                          <Badge variant="outline">{assignment.taskType}</Badge>
                        </div>
                        <p className="font-medium">{assignment.assignedTo}</p>
                        <p className="text-sm text-muted-foreground">
                          Tiempo estimado: {assignment.estimatedTime} minutos
                        </p>
                        {assignment.actualTime && (
                          <p className="text-sm text-muted-foreground">
                            Tiempo real: {assignment.actualTime} minutos
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Alertas de Producción
              </CardTitle>
              <CardDescription>
                Monitorea alertas y notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${
                            alert.severity === 'HIGH' ? 'bg-orange-500' :
                            alert.severity === 'CRITICAL' ? 'bg-red-500' :
                            'bg-yellow-500'
                          }`}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">{alert.type}</Badge>
                        </div>
                        <p className="font-medium">{alert.message}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleString('es-ES')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Reportes de Producción
              </CardTitle>
              <CardDescription>
                Analiza el rendimiento de la producción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="period">Periodo</Label>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger id="period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="week">Esta semana</SelectItem>
                      <SelectItem value="month">Este mes</SelectItem>
                      <SelectItem value="quarter">Este trimestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleGenerateReport}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </Button>
                </div>
              </div>

              {productionKPIs && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Tasa de Completado
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {productionKPIs.completionRate.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Eficiencia
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {productionKPIs.efficiency.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Entrega a Tiempo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {productionKPIs.onTimeDelivery.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Utilización de Personal
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {productionKPIs.staffUtilization.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Duración Promedio
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {productionKPIs.avgTaskDuration.toFixed(0)} min
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Alertas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {productionKPIs.alertCount}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}