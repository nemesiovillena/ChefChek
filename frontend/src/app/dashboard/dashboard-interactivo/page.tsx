'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart,
  LayoutGrid,
  Activity,
  Settings,
  Download,
  RefreshCw,
} from 'lucide-react';

enum DashboardStep {
  KPI_METRICS = 'KPI_METRICS',
  COST_EVOLUTION = 'COST_EVOLUTION',
  FINANCIAL_HEALTH = 'FINANCIAL_HEALTH',
  ALERTS = 'ALERTS',
  MENU_ENGINEERING = 'MENU_ENGINEERING',
}

const dashboardSteps = [
  { id: DashboardStep.KPI_METRICS, label: 'Métricas KPI', icon: Activity },
  { id: DashboardStep.COST_EVOLUTION, label: 'Evolución Costes', icon: TrendingUp },
  { id: DashboardStep.FINANCIAL_HEALTH, label: 'Salud Financiera', icon: DollarSign },
  { id: DashboardStep.ALERTS, label: 'Alertas', icon: AlertTriangle },
  { id: DashboardStep.MENU_ENGINEERING, label: 'Ingeniería Menús', icon: PieChart },
];

interface KPIMetric {
  id: string;
  type: string;
  value: number;
  previousValue?: number;
  changePercentage?: number;
  date: string;
}

interface SupplierCostEvolution {
  supplierId: string;
  supplierName: string;
  monthlyCost: number;
  trend: number;
}

interface FinancialMarginHealth {
  grossMargin: number;
  netMargin: number;
  foodCostPercentage: number;
  healthStatus: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
}

interface ProfitLossAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  affectedMetrics: string[];
  recommendation?: string;
  status: string;
  createdAt: string;
}

interface MenuEngineering {
  menuId: string;
  menuName: string;
  stars: string[];
  plowhorses: string[];
  puzzles: string[];
  dogs: string[];
  recommendations: string[];
}

export const dynamic = 'force-dynamic';

export default function DashboardInteractivoPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(DashboardStep.KPI_METRICS);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([]);
  const [supplierCostEvolution, setSupplierCostEvolution] = useState<SupplierCostEvolution[]>([]);
  const [financialMarginHealth, setFinancialMarginHealth] = useState<FinancialMarginHealth | null>(null);
  const [alerts, setAlerts] = useState<ProfitLossAlert[]>([]);
  const [menuEngineering, setMenuEngineering] = useState<MenuEngineering[]>([]);

  // Period filter
  const [period, setPeriod] = useState('MONTH');
  // Track which period has been loaded; loading is true while period !== loadedPeriod
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null);
  const isLoading = loadedPeriod !== period;

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!user?.id) {
        console.error('No user available');
        return;
      }

      try {
        const headers = {
          'Authorization': `Bearer ${user.id}`,
          'Content-Type': 'application/json',
        };

        // Simulate API calls
        const [kpiResponse, evolutionResponse, healthResponse, alertsResponse, menuResponse] =
          await Promise.all([
            fetch(`/api/v1/dashboard/kpi-metrics?period=${period}`, { headers }),
            fetch(`/api/v1/dashboard/supplier-cost-evolution?period=${period}`, { headers }),
            fetch('/api/v1/dashboard/financial-margin-health', { headers }),
            fetch('/api/v1/dashboard/alerts', { headers }),
            fetch('/api/v1/dashboard/menu-engineering', { headers }),
          ]);

        const [kpiData, evolutionData, healthData, alertsData, menuData] = await Promise.all([
          kpiResponse.json(),
          evolutionResponse.json(),
          healthResponse.json(),
          alertsResponse.json(),
          menuResponse.json(),
        ]);

        if (cancelled) return;
        setKpiMetrics(kpiData);
        setSupplierCostEvolution(evolutionData);
        setFinancialMarginHealth(healthData);
        setAlerts(alertsData);
        setMenuEngineering(menuData);
      } catch (error) {
        console.error('Error isLoading dashboard data:', error);
      } finally {
        if (!cancelled) setLoadedPeriod(period);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [period, user?.id]);

  // Prevent isLoading if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const handleRefresh = async () => {
    if (!user?.id) {
      console.error('No user available');
      return;
    }
    setRefreshing(true);
    try {
      const headers = {
        'Authorization': `Bearer ${user.id}`,
        'Content-Type': 'application/json',
      };

      const [kpiResponse, evolutionResponse, healthResponse, alertsResponse, menuResponse] =
        await Promise.all([
          fetch(`/api/v1/dashboard/kpi-metrics?period=${period}`, { headers }),
          fetch(`/api/v1/dashboard/supplier-cost-evolution?period=${period}`, { headers }),
          fetch('/api/v1/dashboard/financial-margin-health', { headers }),
          fetch('/api/v1/dashboard/alerts', { headers }),
          fetch('/api/v1/dashboard/menu-engineering', { headers }),
        ]);

      const [kpiData, evolutionData, healthData, alertsData, menuData] = await Promise.all([
        kpiResponse.json(),
        evolutionResponse.json(),
        healthResponse.json(),
        alertsResponse.json(),
        menuResponse.json(),
      ]);

      setKpiMetrics(kpiData);
      setSupplierCostEvolution(evolutionData);
      setFinancialMarginHealth(healthData);
      setAlerts(alertsData);
      setMenuEngineering(menuData);
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getStepIndex = (step: DashboardStep) => dashboardSteps.findIndex((s) => s.id === step);

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-4">
        {dashboardSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = getStepIndex(currentStep) > index;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                  isActive ? 'bg-blue-600 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium text-center">{step.label}</span>
                {isCompleted && (
                  <CheckCircle2 className="absolute -top-1 -right-1 w-5 h-5 text-green-500 bg-white rounded-full" />
                )}
              </button>
              {index < dashboardSteps.length - 1 && (
                <div className={`w-12 h-1 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderKPIMetrics = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Métricas KPI</h3>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="TODAY">Hoy</option>
          <option value="WEEK">Esta Semana</option>
          <option value="MONTH">Este Mes</option>
          <option value="QUARTER">Este Trimestre</option>
          <option value="YEAR">Este Año</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiMetrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{metric.type.replace(/_/g, ' ')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metric.type.includes('PERCENTAGE') ? `${metric.value.toFixed(1)}%` : `€${metric.value.toFixed(2)}`}
              </div>
              {metric.changePercentage !== undefined && (
                <div className={`flex items-center gap-1 mt-2 ${metric.changePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.changePercentage >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm">{Math.abs(metric.changePercentage).toFixed(1)}% vs período anterior</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderCostEvolution = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Evolución de Costes de Proveedores</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Proveedores con Mayor Coste</CardTitle>
            <CardDescription>Top 5 proveedores por coste mensual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {supplierCostEvolution.slice(0, 5).map((supplier) => (
                <div key={supplier.supplierId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{supplier.supplierName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">€{supplier.monthlyCost.toFixed(2)}</span>
                      <Badge variant={supplier.trend > 0 ? 'destructive' : 'default'}>
                        {supplier.trend > 0 ? '+' : ''}{supplier.trend.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={Math.min((supplier.monthlyCost / Math.max(...supplierCostEvolution.map(s => s.monthlyCost))) * 100, 100)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Costes</CardTitle>
            <CardDescription>Proveedores con mayor crecimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {supplierCostEvolution
                .filter((s) => s.trend > 5)
                .sort((a, b) => b.trend - a.trend)
                .slice(0, 5)
                .map((supplier) => (
                  <div key={supplier.supplierId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="font-medium">{supplier.supplierName}</span>
                    <Badge variant="destructive">+{supplier.trend.toFixed(1)}%</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderFinancialHealth = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Salud de Márgenes Financieros</h3>

      {financialMarginHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Margen Bruto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{financialMarginHealth.grossMargin.toFixed(1)}%</div>
              <div className="mt-2 text-sm text-gray-600">Meta: {'>'} 65%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Margen Neto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{financialMarginHealth.netMargin.toFixed(1)}%</div>
              <div className="mt-2 text-sm text-gray-600">Meta: {'>'} 15%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Coste de Alimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{financialMarginHealth.foodCostPercentage.toFixed(1)}%</div>
              <div className="mt-2 text-sm text-gray-600">Meta: {'<'} 35%</div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Estado General</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant={financialMarginHealth.healthStatus === 'CRITICAL' ? 'destructive' : 'default'}>
                {financialMarginHealth.healthStatus === 'EXCELLENT' && <CheckCircle2 className="h-4 w-4" />}
                {financialMarginHealth.healthStatus === 'GOOD' && <CheckCircle2 className="h-4 w-4" />}
                {financialMarginHealth.healthStatus === 'WARNING' && <AlertTriangle className="h-4 w-4" />}
                {financialMarginHealth.healthStatus === 'CRITICAL' && <XCircle className="h-4 w-4" />}
                <AlertTitle className="text-lg">
                  {financialMarginHealth.healthStatus === 'EXCELLENT' && 'Excelente'}
                  {financialMarginHealth.healthStatus === 'GOOD' && 'Bueno'}
                  {financialMarginHealth.healthStatus === 'WARNING' && 'Requiere Atención'}
                  {financialMarginHealth.healthStatus === 'CRITICAL' && 'Crítico'}
                </AlertTitle>
                <AlertDescription>
                  {financialMarginHealth.healthStatus === 'EXCELLENT' &&
                    'Todos los márgenes están dentro de los rangos óptimos.'}
                  {financialMarginHealth.healthStatus === 'GOOD' &&
                    'Los márgenes están saludables pero hay espacio para mejora.'}
                  {financialMarginHealth.healthStatus === 'WARNING' &&
                    'Se recomienda revisar costes y precios para mejorar los márgenes.'}
                  {financialMarginHealth.healthStatus === 'CRITICAL' &&
                    'Acción inmediata requerida. Los márgenes están por debajo de los umbrales mínimos.'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Alertas Activas</h3>
        <Button onClick={() => {/* Generate alerts */}} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Generar Alertas
        </Button>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <p className="text-gray-600">No hay alertas activas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Alert key={alert.id} variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{alert.type.replace(/_/g, ' ')}</span>
                <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'outline'}>
                  {alert.severity}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2">{alert.message}</p>
                {alert.recommendation && (
                  <p className="text-sm font-medium mt-2">Recomendación: {alert.recommendation}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline">
                    Resolver
                  </Button>
                  <Button size="sm" variant="ghost">
                    Descartar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );

  const renderMenuEngineering = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Ingeniería de Menús</h3>

      <div className="space-y-6">
        {menuEngineering.map((menu) => (
          <Card key={menu.menuId}>
            <CardHeader>
              <CardTitle>{menu.menuName}</CardTitle>
              <CardDescription>Análisis de popularidad y rentabilidad</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-800 mb-2">⭐ STARS</div>
                  <div className="text-sm text-green-700">
                    Alta popularidad y rentabilidad
                  </div>
                  {menu.stars.length > 0 && (
                    <div className="mt-2 text-xs">
                      {menu.stars.slice(0, 3).map((item, i) => (
                        <div key={i}>• {item}</div>
                      ))}
                      {menu.stars.length > 3 && <div>+ {menu.stars.length - 3} más</div>}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-800 mb-2">🐴 PLOWHORSES</div>
                  <div className="text-sm text-blue-700">
                    Alta rentabilidad, baja popularidad
                  </div>
                  {menu.plowhorses.length > 0 && (
                    <div className="mt-2 text-xs">
                      {menu.plowhorses.slice(0, 3).map((item, i) => (
                        <div key={i}>• {item}</div>
                      ))}
                      {menu.plowhorses.length > 3 && <div>+ {menu.plowhorses.length - 3} más</div>}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="font-semibold text-yellow-800 mb-2">🧩 PUZZLES</div>
                  <div className="text-sm text-yellow-700">
                    Alta popularidad, baja rentabilidad
                  </div>
                  {menu.puzzles.length > 0 && (
                    <div className="mt-2 text-xs">
                      {menu.puzzles.slice(0, 3).map((item, i) => (
                        <div key={i}>• {item}</div>
                      ))}
                      {menu.puzzles.length > 3 && <div>+ {menu.puzzles.length - 3} más</div>}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="font-semibold text-red-800 mb-2">🐕 DOGS</div>
                  <div className="text-sm text-red-700">
                    Baja popularidad y rentabilidad
                  </div>
                  {menu.dogs.length > 0 && (
                    <div className="mt-2 text-xs">
                      {menu.dogs.slice(0, 3).map((item, i) => (
                        <div key={i}>• {item}</div>
                      ))}
                      {menu.dogs.length > 3 && <div>+ {menu.dogs.length - 3} más</div>}
                    </div>
                  )}
                </div>
              </div>

              {menu.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Recomendaciones:</h4>
                  {menu.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-600">→</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Interactivo</h1>
          <p className="text-gray-600">Métricas clave y análisis en tiempo real</p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            {renderStepIndicator()}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {dashboardSteps.find((s) => s.id === currentStep)?.label}
          </h2>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div>
            {currentStep === DashboardStep.KPI_METRICS && renderKPIMetrics()}
            {currentStep === DashboardStep.COST_EVOLUTION && renderCostEvolution()}
            {currentStep === DashboardStep.FINANCIAL_HEALTH && renderFinancialHealth()}
            {currentStep === DashboardStep.ALERTS && renderAlerts()}
            {currentStep === DashboardStep.MENU_ENGINEERING && renderMenuEngineering()}
          </div>
        )}
      </div>
    </div>
  );
}