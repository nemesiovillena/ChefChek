'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useDashboardKPIs } from '@/hooks/use-dashboard-kpis';
import {
  useWebSocketNotifications,
  useWebSocketRooms,
} from '@/hooks/use-websocket';

export const dynamic = 'force-dynamic';

const KITCHEN_ZONE_LABELS: Record<string, string> = {
  HOT_KITCHEN: 'Cocina caliente',
  COLD_KITCHEN: 'Cocina fría',
  PASTRY_KITCHEN: 'Pastelería',
  GRILL_STATION: 'Parrilla',
  FRYING_STATION: 'Fritos',
  PLATING_STATION: 'Emplatado',
  SERVICE_STATION: 'Servicio',
};

const ORDER_TYPE_ICONS: Record<string, string> = {
  PREPARATION: 'restaurant_menu',
  COOKING: 'outdoor_grill',
  PLATING: 'restaurant',
};

export default function DashboardPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();

  // WebSocket hooks
  const { notifications } = useWebSocketNotifications();
  const { joinDashboard } = useWebSocketRooms();

  // Simulación activa de telemetría de temperatura de la cámara fría
  const [temp, setTemp] = useState(3.2);

  // Animación del gráfico de eficiencia al cargar
  const [efficiencyWidth, setEfficiencyWidth] = useState('0%');

  // Redirección si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Efecto para animar la barra de eficiencia
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const timer = setTimeout(() => {
        setEfficiencyWidth('94.2%');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated]);

  // Unirse a rooms de WebSocket
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      joinDashboard();
    }
  }, [isLoading, isAuthenticated, joinDashboard]);

  // Efecto para variar sutilmente la temperatura simulando telemetría real
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const interval = setInterval(() => {
        setTemp(t => {
          const diff = (Math.random() - 0.5) * 0.2;
          const next = parseFloat((t + diff).toFixed(1));
          return next >= 2.8 && next <= 3.6 ? next : t;
        });
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [isLoading, isAuthenticated]);

  // Evitar renderizado mientras se valida la sesión
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#e5e2e1]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl animate-spin text-secondary">progress_activity</span>
          <div className="font-label-md text-label-md tracking-wider">VALIDANDO ACCESO...</div>
        </div>
      </div>
    );
  }

  // Mapeo de valores dinámicos
  const formatKPIValue = (value: number | undefined, loading: boolean) => {
    if (loading) return '--';
    if (value === undefined || value === null) return '00';
    return String(value).padStart(2, '0');
  };

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Vista General de Servicio</span>
          <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">Cocina Principal / Turno AM</h2>
        </div>
        <button 
          onClick={() => router.push('/dashboard/production')}
          className="bg-primary text-primary-foreground px-stack-lg py-stack-md rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-stack-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add_notes</span>
          CREAR ORDEN PRODUCCIÓN
        </button>
      </section>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mt-stack-xl">
        {/* Key Indicators Column */}
        <div className="md:col-span-4 space-y-gutter">
          {/* Status Cards */}
          <div
            onClick={() => router.push('/dashboard/compras')}
            className="tonal-layer-2 p-stack-lg rounded-xl flex items-center justify-between border border-border cursor-pointer hover:border-secondary transition-colors"
          >
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-stack-xs uppercase">Pedidos Pendientes</p>
              <span className="font-headline-lg text-headline-lg text-primary">
                {formatKPIValue(kpis?.pendingOrders, kpisLoading)}
              </span>
            </div>
            <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">local_shipping</span>
            </div>
          </div>

          <div className="tonal-layer-2 p-stack-lg rounded-xl flex items-center justify-between border border-border">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-stack-xs uppercase">Bajo Stock</p>
              <span className="font-headline-lg text-headline-lg text-primary">
                {formatKPIValue(kpis?.lowStockItems, kpisLoading)}
              </span>
            </div>
            <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center">
              <span className={`material-symbols-outlined ${kpis?.lowStockItems && kpis.lowStockItems > 0 ? 'text-error animate-pulse' : 'text-on-surface-variant'}`}>
                warning
              </span>
            </div>
          </div>

          <div className="tonal-layer-2 p-stack-lg rounded-xl flex items-center justify-between border border-border">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-stack-xs uppercase">En Turno</p>
              <span className="font-headline-lg text-headline-lg text-primary">
                {formatKPIValue(kpis?.activeUsers, kpisLoading)}
              </span>
            </div>
            <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">groups</span>
            </div>
          </div>

          {/* Efficiency Index */}
          <div className="tonal-layer-2 p-stack-lg rounded-xl border border-border">
            <div className="flex justify-between items-center mb-stack-md">
              <p className="font-label-md text-label-md text-on-surface-variant uppercase">Índice de Eficiencia</p>
              <span className="font-label-md text-label-md text-primary">94.2%</span>
            </div>
            <div className="h-1 bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary-container transition-all duration-1000"
                style={{ width: efficiencyWidth }}
              ></div>
            </div>
            <p className="mt-stack-md font-body-md text-label-sm text-on-surface-variant italic">
              Rendimiento 4% sobre la media del turno
            </p>
          </div>

          {/* Notificaciones y Alertas: mismo feed persistido que la campana del header */}
          <div className="tonal-layer-2 p-stack-lg rounded-xl border border-border">
            <div className="flex justify-between items-center mb-stack-md">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Notificaciones y Alertas</p>
              <span className="material-symbols-outlined text-secondary text-[20px]">notifications_active</span>
            </div>
            <div className="space-y-stack-sm">
              {notifications.length > 0 ? (
                notifications.slice(0, 4).map((notif) => {
                  const style =
                    notif.type === 'ERROR'
                      ? { wrap: 'bg-error/10 border-error/20', icon: 'text-error', glyph: 'error' }
                      : notif.type === 'WARNING'
                        ? { wrap: 'bg-warning/10 border-warning/20', icon: 'text-warning', glyph: 'warning' }
                        : { wrap: 'bg-secondary-container/10 border-transparent', icon: 'text-secondary', glyph: 'info' };
                  return (
                    <div key={notif.id} className={`flex items-start gap-stack-sm p-2 rounded border ${style.wrap}`}>
                      <span className={`material-symbols-outlined ${style.icon} text-[16px]`}>{style.glyph}</span>
                      <div>
                        <p className="text-xs text-primary font-medium">{notif.title}</p>
                        <p className="text-[11px] text-on-surface-variant leading-tight">{notif.message}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-stack-sm p-2 bg-secondary-container/10 rounded">
                  <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
                  <p className="text-xs text-on-surface-variant">No hay notificaciones</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Task Board */}
        <div className="md:col-span-8">
          <div className="tonal-layer-2 rounded-xl overflow-hidden h-full flex flex-col border border-border">
            <div className="p-stack-lg border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline-md text-headline-md text-primary">Tareas de Prep. Próximas</h3>
              <span className="font-label-sm text-label-sm text-on-surface-variant px-stack-md py-1 bg-surface-variant rounded-full">HOY</span>
            </div>
            <div className="flex-1 divide-y divide-surface-variant">
              {kpisLoading ? (
                <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
                  Cargando tareas...
                </div>
              ) : kpis?.upcomingProductionTasks && kpis.upcomingProductionTasks.length > 0 ? (
                kpis.upcomingProductionTasks.map(task => {
                  const inProgress = task.status === 'IN_PROGRESS';
                  const scheduled = new Date(task.scheduledFor);
                  return (
                    <div
                      key={task.id}
                      onClick={() => router.push('/dashboard/production')}
                      className="p-stack-lg flex items-center justify-between hover:bg-surface-variant transition-colors cursor-pointer select-none active:scale-[0.995] duration-100"
                    >
                      <div className="flex items-center gap-stack-lg">
                        <div className={`w-2 h-12 rounded-full ${inProgress ? 'bg-secondary' : 'bg-primary'}`}></div>
                        <div>
                          <h4 className="font-body-lg text-body-lg text-primary">{task.title}</h4>
                          <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px]">{ORDER_TYPE_ICONS[task.orderType] || 'kitchen'}</span>
                            Estación: {KITCHEN_ZONE_LABELS[task.station] || task.station}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {inProgress ? (
                          <div className="flex flex-col items-end">
                            <span className="material-symbols-outlined text-secondary animate-pulse">progress_activity</span>
                            <p className="text-[10px] text-secondary font-label-sm mt-1 uppercase">En progreso</p>
                          </div>
                        ) : (
                          <div>
                            <span className="font-label-md text-label-md text-secondary">
                              {scheduled.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-[10px] text-on-surface-variant font-label-sm mt-1">EST. {task.estimatedTime} MIN</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
                  No hay tareas de producción pendientes
                </div>
              )}
            </div>
            <div className="p-stack-md bg-surface-container-high text-center border-t border-surface-variant">
              <button 
                onClick={() => router.push('/dashboard/production')}
                className="text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              >
                VER LISTA DE PREPARACIÓN COMPLETA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Atmospheric Secondary Layer */}
      <section className="mt-gutter grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div 
          className="tonal-layer-2 rounded-xl overflow-hidden relative group h-48 border border-border cursor-pointer"
          onClick={() => router.push('/dashboard/recipes')}
        >
          <Image
            alt="Seasonal Veg Prep"
            fill
            className="w-full h-full object-cover opacity-30 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA_IYUl3hekNMpAcZCYRjsZ7_Sf_zxQOvTMS4RQNTTiaKDVGsmncn5fZvSJSmO4AxyElaF_rqmTEqNslT-FpsimF7v92xwk_RWQ2G7yV0ttulljmVkoin8_d_XFhQdKznRcoqd-KSP8ZWtPMlasO-vHOrm6-gTZjYboyL2Zcpn83y-IAiJ8AI3I5JTHqR5UUcWTdCkSvU72j3_HGm3lLzL1LwAjZZjKJ79wiWhE5fJ1Cdbt9ZzRw_hKgzVvLnFgzwqqd-P-NinIRu0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] to-transparent p-stack-lg flex flex-col justify-end">
            <p className="font-label-sm text-label-sm text-secondary tracking-widest uppercase">Resumen de Recetas</p>
            <h4 className="font-headline-md text-headline-md text-primary mt-1">Estación de Vegetales</h4>
          </div>
        </div>

        <div 
          onClick={() => router.push('/dashboard/dashboard-interactivo')}
          className="tonal-layer-2 rounded-xl p-stack-lg border border-border border-dashed flex flex-col items-center justify-center gap-stack-md hover:border-secondary cursor-pointer hover:bg-surface-container-low transition-colors duration-200"
        >
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant hover:text-secondary transition-colors">monitoring</span>
          <p className="font-label-md text-label-md text-on-surface-variant">Telemetría de Cocina en Vivo</p>
        </div>

        <div className="tonal-layer-2 rounded-xl p-stack-lg flex flex-col justify-between border border-border">
          <div>
            <h5 className="font-label-md text-label-md text-on-surface-variant uppercase">Temp. Cámara Fría</h5>
            <p className="font-headline-lg text-headline-lg text-primary transition-all duration-500 font-mono tracking-tight">
              {temp}°C
            </p>
          </div>
          <div className="flex items-center gap-stack-sm text-secondary">
            <span className="material-symbols-outlined text-[16px] animate-pulse">check_circle</span>
            <span className="font-label-sm text-label-sm">Zona de Conservación Óptima</span>
          </div>
        </div>
      </section>
    </div>
  );
}