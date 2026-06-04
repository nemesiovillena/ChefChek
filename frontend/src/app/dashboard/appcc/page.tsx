'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
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
  Thermometer,
  ClipboardCheck,
  Bug,
  Package,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Users,
  Download,
  Search,
  Filter,
  Plus,
} from 'lucide-react';

interface TemperatureControl {
  id: string;
  type: string;
  location: string;
  targetTemperature: number;
  tolerance: number;
  unit: string;
}

interface TemperatureMeasurement {
  id: string;
  temperature: number;
  withinRange: boolean;
  recordedAt: Date;
  notes?: string;
}

interface CleaningPlan {
  id: string;
  name: string;
  frequency: string;
  description?: string;
  responsible: string[];
  tasks: CleaningTask[];
}

interface CleaningTask {
  id: string;
  area: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
}

interface PestControl {
  id: string;
  company: string;
  type: string;
  date: Date;
  nextDate: Date;
  products: string[];
  areasAfectadas: string[];
  responsable: string;
}

interface GoodsReception {
  id: string;
  proveedorId: string;
  temperaturaAlRecepcion: number;
  temperaturaAceptable: number;
  lote: string;
  caducidad: Date;
  albaran: string;
  productos: Array<{
    productId: string;
    quantity: number;
    unit: string;
    temperature: number;
  }>;
}

interface Alert {
  id: string;
  severity: string;
  type: string;
  title: string;
  message: string;
  status: string;
  createdAt: Date;
}

interface ComplianceKPI {
  temperatureCompliance: number;
  cleaningCompliance: number;
  pestControlCoverage: number;
  goodsAcceptanceRate: number;
  alertResponseTime: number;
  overallCompliance: number;
}

export const dynamic = 'force-dynamic';
export default function AppccPage() {
  const [activeTab, setActiveTab] = useState('temperature');

  // Temperature Controls State
  const [temperatureControls, setTemperatureControls] = useState<TemperatureControl[]>([]);
  const [selectedControl, setSelectedControl] = useState<TemperatureControl | null>(null);
  const [measurements, setMeasurements] = useState<TemperatureMeasurement[]>([]);
  const [newTemp, setNewTemp] = useState('');
  const [tempNotes, setTempNotes] = useState('');

  // Cleaning Plans State
  const [cleaningPlans, setCleaningPlans] = useState<CleaningPlan[]>([]);
  const [newCleaningPlan, setNewCleaningPlan] = useState({
    name: '',
    frequency: 'DAILY',
    description: '',
  });

  // Pest Controls State
  const [pestControls, setPestControls] = useState<PestControl[]>([]);

  // Goods Reception State
  const [goodsReceptions, setGoodsReceptions] = useState<GoodsReception[]>([]);

  // Alerts State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertFilter, setAlertFilter] = useState('');

  // Compliance State
  const [complianceKPIs, setComplianceKPIs] = useState<ComplianceKPI | null>(null);
  const [reportPeriod, setReportPeriod] = useState('MONTHLY');

  useEffect(() => {
    loadTemperatureControls();
    loadCleaningPlans();
    loadPestControls();
    loadGoodsReceptions();
    loadAlerts();
  }, []);

  const loadTemperatureControls = async () => {
    // Mock data - replace with API call
    setTemperatureControls([
      {
        id: '1',
        type: 'CAMERA',
        location: 'Cámara de Congelación',
        targetTemperature: -18,
        tolerance: 2,
        unit: 'CELSIUS',
      },
      {
        id: '2',
        type: 'CAMERA',
        location: 'Cámara de Refrigeración',
        targetTemperature: 4,
        tolerance: 2,
        unit: 'CELSIUS',
      },
    ]);
  };

  const loadMeasurements = async (controlId: string) => {
    // Mock data - replace with API call
    setMeasurements([
      {
        id: '1',
        temperature: -17.5,
        withinRange: true,
        recordedAt: new Date(),
        notes: 'Todo en orden',
      },
      {
        id: '2',
        temperature: -16.8,
        withinRange: true,
        recordedAt: new Date(Date.now() - 3600000),
        notes: '',
      },
    ]);
  };

  const handleRecordTemperature = async () => {
    if (!newTemp || !selectedControl) return;

    const temperature = parseFloat(newTemp);
    const isWithinRange =
      temperature >= selectedControl.targetTemperature - selectedControl.tolerance &&
      temperature <= selectedControl.targetTemperature + selectedControl.tolerance;

    const newMeasurement: TemperatureMeasurement = {
      id: Date.now().toString(),
      temperature,
      withinRange: isWithinRange,
      recordedAt: new Date(),
      notes: tempNotes,
    };

    setMeasurements([newMeasurement, ...measurements]);
    setNewTemp('');
    setTempNotes('');
  };

  const loadCleaningPlans = async () => {
    // Mock data - replace with API call
    setCleaningPlans([
      {
        id: '1',
        name: 'Limpieza Diaria Cocina',
        frequency: 'DAILY',
        description: 'Limpieza diaria de todas las zonas de cocina',
        responsible: ['Juan', 'María'],
        tasks: [
          { id: '1', area: 'Parrilla', description: 'Limpiar parrilla', completed: true },
          { id: '2', area: 'Frigorífico', description: 'Limpiar frigorífico', completed: false },
        ],
      },
    ]);
  };

  const loadPestControls = async () => {
    // Mock data - replace with API call
    setPestControls([
      {
        id: '1',
        company: 'PestControl S.L.',
        type: 'RATS',
        date: new Date('2026-05-15'),
        nextDate: new Date('2026-08-15'),
        products: ['Raticida X', 'Trampa especial'],
        areasAfectadas: ['Cocina', 'Almacén'],
        responsable: 'Juan Pérez',
      },
    ]);
  };

  const loadGoodsReceptions = async () => {
    // Mock data - replace with API call
    setGoodsReceptions([
      {
        id: '1',
        proveedorId: '1',
        temperaturaAlRecepcion: 5,
        temperaturaAceptable: 7,
        lote: 'L001',
        caducidad: new Date('2026-12-01'),
        albaran: 'A-2026-001',
        productos: [
          {
            productId: '1',
            quantity: 10,
            unit: 'kg',
            temperature: 5,
          },
        ],
      },
    ]);
  };

  const loadAlerts = async () => {
    // Mock data - replace with API call
    setAlerts([
      {
        id: '1',
        severity: 'HIGH',
        type: 'TEMPERATURE',
        title: 'Alerta de Temperatura - Cámara de Congelación',
        message: 'Temperatura -15°C fuera de rango (-18°C ± 2°C)',
        status: 'OPEN',
        createdAt: new Date(),
      },
      {
        id: '2',
        severity: 'MEDIUM',
        type: 'CLEANING',
        title: 'Recordatorio de Limpieza - Limpieza Diaria Cocina',
        message: '1 tarea pendiente del plan "Limpieza Diaria Cocina"',
        status: 'OPEN',
        createdAt: new Date(),
      },
    ]);
  };

  const handleGenerateComplianceReport = async () => {
    // Mock data - replace with API call
    setComplianceKPIs({
      temperatureCompliance: 95,
      cleaningCompliance: 88,
      pestControlCoverage: 100,
      goodsAcceptanceRate: 92,
      alertResponseTime: 45,
      overallCompliance: 91.67,
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-500';
      case 'IN_PROGRESS':
        return 'bg-yellow-500';
      case 'RESOLVED':
        return 'bg-green-500';
      case 'CLOSED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Control Sanitario APPCC</h1>
          <p className="text-muted-foreground">
            Sistema de registro y seguimiento de controles sanitarios
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="temperature">
            <Thermometer className="mr-2 h-4 w-4" />
            Temperatura
          </TabsTrigger>
          <TabsTrigger value="cleaning">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Limpieza
          </TabsTrigger>
          <TabsTrigger value="pest">
            <Bug className="mr-2 h-4 w-4" />
            Plagas
          </TabsTrigger>
          <TabsTrigger value="reception">
            <Package className="mr-2 h-4 w-4" />
            Recepciones
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <TrendingUp className="mr-2 h-4 w-4" />
            Cumplimiento
          </TabsTrigger>
        </TabsList>

        {/* Temperature Controls */}
        <TabsContent value="temperature" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5" />
                  Controles de Temperatura
                </CardTitle>
                <CardDescription>
                  Selecciona un control para registrar temperaturas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {temperatureControls.map((control) => (
                    <div
                      key={control.id}
                      onClick={() => {
                        setSelectedControl(control);
                        loadMeasurements(control.id);
                      }}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedControl?.id === control.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{control.location}</p>
                          <p className="text-sm opacity-80">
                            Target: {control.targetTemperature}°C ± {control.tolerance}°C
                          </p>
                        </div>
                        <Badge variant="outline">{control.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registro de Temperatura</CardTitle>
                <CardDescription>
                  {selectedControl
                    ? `Registrando para: ${selectedControl.location}`
                    : 'Selecciona un control para registrar'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedControl ? (
                  <p className="text-sm text-muted-foreground">
                    Selecciona un control de temperatura para comenzar
                  </p>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="temperature">Temperatura (°C)</Label>
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        placeholder="Ej: -18.5"
                        value={newTemp}
                        onChange={(e) => setNewTemp(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notas (opcional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Observaciones sobre el registro"
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleRecordTemperature} className="w-full">
                      <Thermometer className="mr-2 h-4 w-4" />
                      Registrar Temperatura
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedControl && (
            <Card>
              <CardHeader>
                <CardTitle>Historial de Mediciones</CardTitle>
                <CardDescription>Últimos registros de temperatura</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {measurements.map((measurement) => (
                    <div
                      key={measurement.id}
                      className={`p-4 rounded-lg border ${
                        measurement.withinRange
                          ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                          : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-lg">
                            {measurement.temperature}°{selectedControl.unit}
                          </p>
                          <p className="text-sm opacity-80">
                            {new Date(measurement.recordedAt).toLocaleString('es-ES')}
                          </p>
                          {measurement.notes && (
                            <p className="text-sm mt-2">{measurement.notes}</p>
                          )}
                        </div>
                        <Badge
                          variant={measurement.withinRange ? 'default' : 'destructive'}
                        >
                          {measurement.withinRange ? 'En rango' : 'Fuera de rango'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cleaning Plans */}
        <TabsContent value="cleaning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Planes de Limpieza
              </CardTitle>
              <CardDescription>
                Gestiona los planes de limpieza y tareas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cleaningPlans.map((plan) => (
                  <div key={plan.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-lg">{plan.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{plan.frequency}</Badge>
                          {plan.responsible.map((resp) => (
                            <Badge key={resp} variant="secondary">
                              {resp}
                            </Badge>
                          ))}
                        </div>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {plan.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Tareas:</p>
                      {plan.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`p-3 rounded border ${
                            task.completed
                              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                              : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{task.description}</p>
                              <p className="text-sm text-muted-foreground">{task.area}</p>
                              {task.completedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completado: {new Date(task.completedAt).toLocaleString('es-ES')}
                                </p>
                              )}
                            </div>
                            <Badge variant={task.completed ? 'default' : 'secondary'}>
                              {task.completed ? 'Completado' : 'Pendiente'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pest Controls */}
        <TabsContent value="pest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Control de Plagas
              </CardTitle>
              <CardDescription>
                Registro de tratamientos de control de plagas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pestControls.map((pest) => (
                  <div key={pest.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-medium text-lg">{pest.company}</h3>
                        <Badge variant="outline" className="mt-2">
                          {pest.type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Fecha: {new Date(pest.date).toLocaleDateString('es-ES')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Próximo: {new Date(pest.nextDate).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium mb-2">Productos:</p>
                        <div className="space-y-1">
                          {pest.products.map((product, idx) => (
                            <Badge key={idx} variant="secondary">
                              {product}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Áreas Afectadas:</p>
                        <div className="space-y-1">
                          {pest.areasAfectadas.map((area, idx) => (
                            <Badge key={idx} variant="outline">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Responsable: {pest.responsable}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goods Reception */}
        <TabsContent value="reception" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Recepción de Mercancías
              </CardTitle>
              <CardDescription>
                Control de recepción y validación de productos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goodsReceptions.map((reception) => (
                  <div key={reception.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-medium text-lg">
                          Albarán: {reception.albaran}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Lote: {reception.lote}
                        </p>
                      </div>
                      <Badge
                        variant={
                          reception.temperaturaAlRecepcion <= reception.temperaturaAceptable
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {reception.temperaturaAlRecepcion <= reception.temperaturaAceptable
                          ? 'Aceptado'
                          : 'Rechazado'}
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Temperatura Recepción</p>
                        <p className="font-medium">{reception.temperaturaAlRecepcion}°C</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Temperatura Aceptable</p>
                        <p className="font-medium">{reception.temperaturaAceptable}°C</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Caducidad</p>
                        <p className="font-medium">
                          {new Date(reception.caducidad).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Productos:</p>
                      <div className="space-y-2">
                        {reception.productos.map((product, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center p-2 bg-muted rounded"
                          >
                            <span className="text-sm">
                              Producto {idx + 1}: {product.quantity} {product.unit}
                            </span>
                            <Badge variant="outline">{product.temperature}°C</Badge>
                          </div>
                        ))}
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
                <AlertTriangle className="h-5 w-5" />
                Sistema de Alertas
              </CardTitle>
              <CardDescription>
                Gestiona y monitorea alertas y recordatorios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts
                  .filter((alert) => {
                    if (!alertFilter) return true;
                    return alert.type.toLowerCase().includes(alertFilter.toLowerCase());
                  })
                  .map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <Badge className={getStatusColor(alert.status)}>
                              {alert.status}
                            </Badge>
                            <Badge variant="outline">{alert.type}</Badge>
                          </div>
                          <h3 className="font-medium text-lg">{alert.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.message}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Creado: {new Date(alert.createdAt).toLocaleString('es-ES')}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Reports */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Reporte de Cumplimiento APPCC
              </CardTitle>
              <CardDescription>
                Genera reportes de cumplimiento y KPIs sanitarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="period">Periodo</Label>
                  <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v || 'MONTHLY')}>
                    <SelectTrigger id="period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Diario</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensual</SelectItem>
                      <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleGenerateComplianceReport}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </Button>
                </div>
              </div>

              {complianceKPIs && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Cumplimiento General
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {complianceKPIs.overallCompliance.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Cumplimiento Temperaturas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {complianceKPIs.temperatureCompliance.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Cumplimiento Limpieza
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {complianceKPIs.cleaningCompliance.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Tasa Aceptación Mercancías
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {complianceKPIs.goodsAcceptanceRate.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Cobertura Control Plagas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {complianceKPIs.pestControlCoverage.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Tiempo Respuesta Alertas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {complianceKPIs.alertResponseTime.toFixed(1)} min
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