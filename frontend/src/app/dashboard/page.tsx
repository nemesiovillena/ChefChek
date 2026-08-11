'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useDashboardKPIs, useCompleteProductionTask } from '@/hooks/use-dashboard-kpis';
import { resolveNotificationRoute } from '@/lib/notification-routes';
import {
  useWebSocketNotifications,
  useWebSocketRooms,
} from '@/hooks/use-websocket';

export const dynamic = 'force-dynamic';

// Tope de tareas visibles en la card del dashboard; el resto se consulta en
// /dashboard/production vía el botón "VER LISTA DE PREPARACIÓN COMPLETA",
// que solo se muestra si realmente quedan tareas fuera de este tope.
const DASHBOARD_TASKS_LIMIT = 6;

export default function DashboardPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const completeTask = useCompleteProductionTask();

  // WebSocket hooks
  const { notifications, markAsRead, markAllAsRead } = useWebSocketNotifications();
  const { joinDashboard } = useWebSocketRooms();
  const [showAllNotifications, setShowAllNotifications] = useState(false);

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

  const handleCompleteTask = async (e: React.MouseEvent, task: NonNullable<typeof kpis>['upcomingProductionTasks'][number]) => {
    e.stopPropagation();
    await completeTask.mutateAsync({ orderId: task.id, actualTime: task.estimatedTime ?? 0 });
  };

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

  // Fragmentos reutilizados en el orden móvil (pedido por el usuario) y en el
  // bento grid de escritorio, que agrupa las cards de otra forma.
  const pedidosPendientesCard = (
    <div
      onClick={() => router.push('/dashboard/compras')}
      className="relative tonal-layer-2 p-stack-lg rounded-xl flex items-center justify-between border border-border cursor-pointer hover:border-secondary transition-colors"
    >
      {!!kpis?.scheduledDraftOrders && kpis.scheduledDraftOrders > 0 && (
        <span
          className="absolute -top-1 -right-1 bg-error text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          title={`${kpis.scheduledDraftOrders} pedido(s) programado(s) por revisar`}
        >
          {kpis.scheduledDraftOrders > 9 ? '9+' : kpis.scheduledDraftOrders}
        </span>
      )}
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
  );

  const notificacionesCard = (
    <div className="tonal-layer-2 p-stack-lg rounded-xl border border-border">
      <div className="flex justify-between items-center mb-stack-md">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Notificaciones y Alertas</p>
        <div className="flex items-center gap-stack-md shrink-0">
          <button
            onClick={markAllAsRead}
            className="text-secondary text-[11px] hover:underline cursor-pointer"
          >
            Marcar Todas
          </button>
          <button
            onClick={() => setShowAllNotifications((prev) => !prev)}
            className="text-secondary text-[11px] hover:underline cursor-pointer"
          >
            {showAllNotifications ? 'Ver no leídas' : 'Ver Todas'}
          </button>
        </div>
      </div>
      <div className="space-y-stack-sm">
        {(() => {
          const visibleNotifications = showAllNotifications
            ? notifications
            : notifications.filter((notif) => !notif.read);
          return visibleNotifications.length === 0 ? (
            <div className="flex items-center gap-stack-sm p-2 bg-secondary-container/10 rounded">
              <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
              <p className="text-xs text-on-surface-variant">
                {showAllNotifications ? 'No hay notificaciones' : 'No hay notificaciones sin leer'}
              </p>
            </div>
          ) : (
            visibleNotifications.slice(0, showAllNotifications ? 20 : 4).map((notif) => {
              const style =
                notif.type === 'ERROR'
                  ? { wrap: 'bg-error/10 border-error/20', icon: 'text-error', glyph: 'error' }
                  : notif.type === 'WARNING'
                    ? { wrap: 'bg-warning/10 border-warning/20', icon: 'text-warning', glyph: 'warning' }
                    : { wrap: 'bg-secondary-container/10 border-transparent', icon: 'text-secondary', glyph: 'info' };
              const route = resolveNotificationRoute(notif.entityType, notif.entityId);
              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    markAsRead(notif.id);
                    if (route) router.push(route);
                  }}
                  className={`flex items-start gap-stack-sm p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${style.wrap} ${!notif.read ? '' : 'opacity-60'}`}
                >
                  <span className={`material-symbols-outlined ${style.icon} text-[16px]`}>{style.glyph}</span>
                  <div>
                    <p className="text-xs text-primary font-medium">{notif.title}</p>
                    <p className="text-[11px] text-on-surface-variant leading-tight">{notif.message}</p>
                  </div>
                </div>
              );
            })
          );
        })()}
      </div>
    </div>
  );

  const visibleTasks = kpis?.upcomingProductionTasks?.slice(0, DASHBOARD_TASKS_LIMIT) ?? [];
  const hasMoreTasks = (kpis?.upcomingProductionTasks?.length ?? 0) > DASHBOARD_TASKS_LIMIT;

  const tareasPendientesBoard = (
    <div className="tonal-layer-2 rounded-xl overflow-hidden h-full flex flex-col border border-border">
      <div className="p-stack-lg border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
        <h3 className="font-headline-md text-headline-md text-primary">Tareas de Prep. Próximas</h3>
        <span className="font-label-sm text-label-sm text-on-surface-variant px-stack-md py-1 bg-surface-variant rounded-full">
          {kpis?.upcomingProductionTasks?.length ?? 0}
        </span>
      </div>
      <div className="flex-1 divide-y divide-surface-variant">
        {kpisLoading ? (
          <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
            Cargando tareas...
          </div>
        ) : visibleTasks.length > 0 ? (
          visibleTasks.map(task => {
            const inProgress = task.status === 'IN_PROGRESS';
            const lotDate = new Date(task.lotDate);
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
                      <span className="material-symbols-outlined text-[14px]">person</span>
                      {task.assignedStaffNames.length > 0
                        ? task.assignedStaffNames.join(', ')
                        : 'Sin asignar'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-stack-lg">
                  <div className="text-right">
                    {inProgress ? (
                      <div className="flex flex-col items-end">
                        <span className="material-symbols-outlined text-secondary animate-pulse">progress_activity</span>
                        <p className="text-[10px] text-secondary font-label-sm mt-1 uppercase">En progreso</p>
                      </div>
                    ) : (
                      <span className="font-label-md text-label-md text-secondary">
                        {lotDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleCompleteTask(e, task)}
                    disabled={completeTask.isPending}
                    title="Marcar tarea como completada"
                    className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-secondary bg-secondary-container/15 hover:bg-secondary-container/30 hover:text-primary active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">task_alt</span>
                  </button>
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
      {hasMoreTasks && (
        <div className="p-stack-md bg-surface-container-high text-center border-t border-surface-variant">
          <button
            onClick={() => router.push('/dashboard/production')}
            className="text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            VER LISTA DE PREPARACIÓN COMPLETA
          </button>
        </div>
      )}
    </div>
  );

  const recetasCard = (
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
        <p className="font-label-sm text-label-sm text-secondary tracking-widest uppercase">Listado de Recetas</p>
      </div>
    </div>
  );

  const comprasCard = (
    <div
      onClick={() => router.push('/dashboard/compras')}
      className="tonal-layer-2 rounded-xl p-stack-lg border border-border border-dashed flex flex-col items-center justify-center gap-stack-md hover:border-secondary cursor-pointer hover:bg-surface-container-low transition-colors duration-200"
    >
      <span className="material-symbols-outlined text-[40px] text-on-surface-variant hover:text-secondary transition-colors">shopping_cart</span>
      <p className="font-label-md text-label-md text-on-surface-variant">Compras</p>
    </div>
  );

  const crearOrdenButton = (extraClassName: string) => (
    <button
      onClick={() => router.push('/dashboard/production')}
      className={`bg-primary text-primary-foreground px-stack-lg py-stack-md rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all items-center gap-stack-sm cursor-pointer ${extraClassName}`}
    >
      <span className="material-symbols-outlined text-[18px]">add_notes</span>
      CREAR ORDEN PRODUCCIÓN
    </button>
  );

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Vista General de Servicio</span>
          <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">Cocina Principal</h2>
        </div>
        {crearOrdenButton('hidden md:flex')}
      </section>

      {/* Orden móvil: Tareas pendientes, Crear Tarea, Pedidos Pendientes,
          Notificaciones y Alertas, Recetas, Compras. El resto de cards
          (Bajo Stock, En Turno, Eficiencia, Telemetría, Temp. Cámara Fría)
          no tienen datos reales todavía y quedan ocultas en móvil. */}
      <div className="flex flex-col gap-gutter mt-stack-xl md:hidden">
        {tareasPendientesBoard}
        {crearOrdenButton('flex justify-center')}
        {pedidosPendientesCard}
        {notificacionesCard}
        {recetasCard}
        {comprasCard}
      </div>

      {/* Bento Grid Content (escritorio) */}
      <div className="hidden md:grid md:grid-cols-12 gap-gutter mt-stack-xl">
        {/* Key Indicators Column */}
        <div className="md:col-span-4 space-y-gutter">
          {pedidosPendientesCard}

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

          {notificacionesCard}
        </div>

        {/* Main Task Board */}
        <div className="md:col-span-8">
          {tareasPendientesBoard}
        </div>
      </div>

      {/* Atmospheric Secondary Layer (escritorio) */}
      <section className="hidden md:grid mt-gutter md:grid-cols-3 gap-gutter">
        {recetasCard}

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