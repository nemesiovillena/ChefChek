'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import {
  useDashboardKPIs,
  useCompleteProductionTask,
  useReorderProductionTasks,
} from '@/hooks/use-dashboard-kpis';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';
import { compareSalaTasksByEventDate, useSalaTasks, type SalaTask } from '@/hooks/use-sala-tasks';
import { useRowsThatFit } from '@/hooks/use-rows-that-fit';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import { PostponeTaskDialog } from './production/tasks/postpone-task-dialog';
import { UpcomingTaskRow } from './upcoming-task-row';
import { SalaTaskRow } from './sala-task-row';
import { SalaTaskModal } from '@/components/sala-tasks/sala-task-modal';
import { resolveNotificationRoute } from '@/lib/notification-routes';
import {
  useWebSocketNotifications,
  useWebSocketRooms,
} from '@/hooks/use-websocket';

export const dynamic = 'force-dynamic';

// Mínimo de tareas de prep. visibles en la card del dashboard. En escritorio la
// card estira su altura para igualar la columna izquierda, así que se muestran
// tantas tareas como quepan enteras en ese alto (useRowsThatFit); este valor es
// solo el suelo. El resto se consulta en /dashboard/production/tasks vía el
// botón "VER LISTA DE PREPARACIÓN COMPLETA", que solo aparece si de verdad
// quedan tareas fuera de lo mostrado.
const PRODUCTION_TASKS_LIMIT = 4;

// Tope de notificaciones de sala visibles en su card resumen; el resto se
// consulta en /dashboard/sala-notificaciones (tablero Kanban completo).
const SALA_TASKS_LIMIT = 4;

export default function DashboardPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const completeTask = useCompleteProductionTask();
  const reorderTasks = useReorderProductionTasks();
  const [postponingTask, setPostponingTask] = useState<UpcomingProductionTask | null>(null);
  const { isEnabled } = useModules();
  const { canSee } = useSectionAccess();
  const salaNotificacionesEnabled = isEnabled('sala-notificaciones') && canSee('sala-notificaciones');
  // Producción oculta pero "ver tareas" activo → board de solo lectura.
  const canSeeProduction = canSee('production');
  const canSeePrepTasks = canSeeProduction || canSee('production.tasks');
  const canSeeRecipes = canSee('recipes');
  const canSeeCompras = canSee('compras');
  const canSeeCosts = canSee('recipes.cost');
  const canSeeEtiquetado = isEnabled('etiquetado') && canSee('etiquetado');
  // Card de notificaciones/alertas: mayormente avisos de precio y compras.
  const canSeeAlerts = canSeeCosts || canSeeCompras;
  const { data: salaTasks, isLoading: salaTasksLoading } = useSalaTasks(salaNotificacionesEnabled);
  const [editingSalaTask, setEditingSalaTask] = useState<SalaTask | null>(null);
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  // Escritorio: nº de tareas de prep. que caben enteras en el alto de la card
  // (la impone la columna izquierda). En móvil / card oculta mide 0 → PRODUCTION_TASKS_LIMIT.
  const { ref: prepListRef, rows: prepRowsThatFit } = useRowsThatFit(PRODUCTION_TASKS_LIMIT);

  // WebSocket hooks
  const { notifications, markAsRead, markAllAsRead } = useWebSocketNotifications();
  const { joinDashboard } = useWebSocketRooms();
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  // Simulación activa de telemetría de temperatura de la cámara fría
  const [temp, setTemp] = useState(3.2);

  // Redirección si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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

  const handlePostponeClick = (e: React.MouseEvent, task: UpcomingProductionTask) => {
    e.stopPropagation();
    setPostponingTask(task);
  };

  const handleTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !kpis) return;

    const allTasks = kpis.upcomingProductionTasks ?? [];
    const visibleCount = Math.min(prepRowsThatFit, allTasks.length);
    const visible = allTasks.slice(0, visibleCount);
    const oldIndex = visible.findIndex((t) => t.id === active.id);
    const newIndex = visible.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(visible, oldIndex, newIndex);
    queryClient.setQueryData(['dashboard-kpis'], {
      ...kpis,
      upcomingProductionTasks: [...reordered, ...allTasks.slice(visibleCount)],
    });
    reorderTasks.mutate(reordered.map((t) => t.id));
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

  // 'YYYY-MM-DD' -> 'DD/MM' para la card de Pedidos Pendientes.
  const formatNextScheduledDate = (dateKey: string, isToday: boolean) => {
    if (isToday) return 'HOY';
    const [, month, day] = dateKey.split('-');
    return `${day}/${month}`;
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
        {kpis?.nextScheduledPurchase && (
          <p
            className={`text-[11px] mt-stack-xs ${
              kpis.nextScheduledPurchase.isPendingDraft
                ? 'text-error font-bold'
                : 'text-error font-medium'
            }`}
          >
            {kpis.nextScheduledPurchase.isPendingDraft ? (
              <>
                Pendiente de enviar · {kpis.nextScheduledPurchase.supplierName} ·{' '}
                {formatNextScheduledDate(
                  kpis.nextScheduledPurchase.dateKey,
                  kpis.nextScheduledPurchase.isToday,
                )}{' '}
                {kpis.nextScheduledPurchase.timeOfDay}
              </>
            ) : (
              <>
                {kpis.nextScheduledPurchase.isToday && (
                  <span className="mr-1 inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 align-middle text-[9px] font-bold text-primary-foreground">
                    HOY
                  </span>
                )}
                Programado: {kpis.nextScheduledPurchase.supplierName} ·{' '}
                {formatNextScheduledDate(
                  kpis.nextScheduledPurchase.dateKey,
                  kpis.nextScheduledPurchase.isToday,
                )}{' '}
                {kpis.nextScheduledPurchase.timeOfDay}
              </>
            )}
          </p>
        )}
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
      <div className="space-y-stack-sm max-h-80 overflow-y-auto pr-1">
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
            visibleNotifications.slice(0, 20).map((notif) => {
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

  const allPrepTasks = kpis?.upcomingProductionTasks ?? [];

  // fillContainer: escritorio, la card estira su alto → mostrar tantas tareas
  // como quepan (prepRowsThatFit). Móvil: card a contenido → tope fijo.
  const renderPrepTasksBoard = (fillContainer: boolean) => {
    const visibleCount = fillContainer
      ? Math.min(prepRowsThatFit, allPrepTasks.length)
      : PRODUCTION_TASKS_LIMIT;
    const visibleTasks = allPrepTasks.slice(0, visibleCount);
    const hasMoreTasks = allPrepTasks.length > visibleTasks.length;
    // Fase del contenido de la lista: mientras es "loading" o "empty" se mide
    // contra un placeholder, no una fila real. Cambiar el `key` con la fase
    // fuerza un remount del contenedor (re-attach del ref) justo cuando la
    // primera fila real aparece (o la lista vuelve a vaciarse), para que la
    // medición no se quede pegada a la altura del placeholder.
    const listPhase = kpisLoading ? 'loading' : allPrepTasks.length === 0 ? 'empty' : 'rows';

    return (
    <div className="tonal-layer-2 rounded-xl overflow-hidden h-full flex flex-col border border-border">
      <div className="p-stack-lg border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
        <h3 className="font-headline-md text-headline-md text-primary">Tareas de Prep. Próximas</h3>
        <span className="font-label-sm text-label-sm text-on-surface-variant px-stack-md py-1 bg-surface-variant rounded-full">
          {allPrepTasks.length}
        </span>
      </div>
      <div
        ref={fillContainer ? prepListRef : undefined}
        key={fillContainer ? listPhase : undefined}
        // flex-basis explícito en px (no flex-1/0%): con altura de card indefinida
        // durante el cálculo intrínseco del grid, una base en "0%" cae a "auto" y
        // el panel crece con su contenido, inflando la fila del grid entero (bug
        // real: dejaba un hueco bajo la columna izquierda). "0px" no tiene ese
        // fallback, así que el panel no aporta altura intrínseca y el sobrante
        // real se resuelve con overflow-y-auto en vez de crecer la card.
        className={`divide-y divide-surface-variant${
          fillContainer ? ' flex-[1_1_0px] min-h-0 overflow-y-auto' : ' flex-1'
        }`}
      >
        {kpisLoading ? (
          <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
            Cargando tareas...
          </div>
        ) : visibleTasks.length > 0 ? (
          canSeeProduction ? (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
              <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {visibleTasks.map((task) => (
                  <UpcomingTaskRow
                    key={task.id}
                    task={task}
                    onNavigate={() => router.push(`/dashboard/production?batchId=${task.batchId}&orderId=${task.id}`)}
                    onComplete={(e) => handleCompleteTask(e, task)}
                    onPostpone={(e) => handlePostponeClick(e, task)}
                    completeDisabled={completeTask.isPending}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            // Rol restringido: puede ver y completar tareas, sin navegar a
            // Producción, sin reordenar ni posponer.
            visibleTasks.map((task) => (
              <UpcomingTaskRow
                key={task.id}
                task={task}
                onComplete={(e) => handleCompleteTask(e, task)}
                completeDisabled={completeTask.isPending}
                readOnly
              />
            ))
          )
        ) : (
          <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
            No hay tareas de producción pendientes
          </div>
        )}
      </div>
      {hasMoreTasks && canSeeProduction && (
        <div className="p-stack-md bg-surface-container-high text-center border-t border-surface-variant">
          <button
            onClick={() => router.push('/dashboard/production/tasks')}
            className="text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            VER LISTA DE PREPARACIÓN COMPLETA
          </button>
        </div>
      )}
    </div>
    );
  };

  // Orden cronológico por fecha del evento (más próximo primero, sin separar
  // por estado); completadas quedan fuera del resumen (solo en el Kanban).
  const activeSalaTasks = (salaTasks ?? [])
    .filter((t) => t.status !== 'COMPLETADO')
    .sort(compareSalaTasksByEventDate);
  const visibleSalaTasks = activeSalaTasks.slice(0, SALA_TASKS_LIMIT);
  const hasMoreSalaTasks = activeSalaTasks.length > SALA_TASKS_LIMIT;

  // Sin h-full a propósito: vive apilada junto a otras cards en la columna
  // izquierda (space-y-gutter, flujo de bloque normal, no flex) — h-full ahí
  // haría que intentara ocupar el 100% de la altura de la columna entera y
  // desbordara la página (bug real que causaba scroll en el dashboard).
  const salaTasksBoard = (
    <div className="tonal-layer-2 rounded-xl overflow-hidden flex flex-col border border-border">
      <div className="p-stack-lg border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
        <h3 className="font-headline-md text-headline-md text-primary">Notificaciones de Sala</h3>
        <span className="font-label-sm text-label-sm text-on-surface-variant px-stack-md py-1 bg-surface-variant rounded-full">
          {activeSalaTasks.length}
        </span>
      </div>
      <div className="flex-1 divide-y divide-surface-variant">
        {salaTasksLoading ? (
          <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
            Cargando notificaciones...
          </div>
        ) : visibleSalaTasks.length > 0 ? (
          visibleSalaTasks.map((task) => (
            <SalaTaskRow key={task.id} task={task} onClick={() => setEditingSalaTask(task)} />
          ))
        ) : (
          <div className="p-stack-lg text-center text-on-surface-variant font-label-md text-label-md">
            Sin reservas, menús o encargos de sala
          </div>
        )}
      </div>
      {hasMoreSalaTasks && (
        <div className="p-stack-md bg-surface-container-high text-center border-t border-surface-variant">
          <button
            onClick={() => router.push('/dashboard/sala-notificaciones')}
            className="text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            MOSTRAR TODAS
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

  const etiquetadoCard = (
    <div
      onClick={() => router.push('/dashboard/etiquetado/nueva')}
      className="group relative tonal-layer-2 rounded-xl p-stack-lg flex flex-col justify-between gap-stack-md border border-border overflow-hidden cursor-pointer hover:border-secondary hover:bg-surface-container-low transition-colors duration-200"
    >
      {/* Motivo de etiqueta impresa: esquina troquelada + perforación */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-7 -top-7 h-16 w-16 rotate-45 border border-dashed border-border/70 group-hover:border-secondary/60 transition-colors"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-3 top-3 h-1.5 w-1.5 rounded-full border border-border group-hover:border-secondary/70 transition-colors"
      />

      <div className="flex items-center gap-stack-md">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container/40 text-secondary transition-transform duration-300 group-hover:-rotate-6">
          <span className="material-symbols-outlined text-[22px]">label</span>
        </span>
        <div>
          <h5 className="font-label-md text-label-md text-primary uppercase tracking-wide">Etiquetado</h5>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Trazabilidad y caducidades</p>
        </div>
      </div>

      <div className="flex items-center gap-stack-sm text-on-surface-variant group-hover:text-secondary transition-colors">
        <span className="font-label-sm text-label-sm">Crear etiqueta</span>
        <span className="material-symbols-outlined text-[16px] transition-transform duration-300 group-hover:rotate-90">
          add
        </span>
      </div>
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
    <>
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Vista General de Servicio</span>
          <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">Cocina Principal</h2>
        </div>
        {canSeeProduction && crearOrdenButton('hidden md:flex')}
      </section>

      {/* Orden móvil: Tareas pendientes, Notificaciones de Sala, Crear Tarea,
          Pedidos Pendientes, Notificaciones y Alertas, Recetas, Etiquetado, Compras.
          Telemetría y Temp. Cámara Fría no tienen datos reales todavía y
          quedan ocultas en móvil. */}
      <div className="flex flex-col gap-gutter mt-stack-xl md:hidden">
        {canSeePrepTasks && renderPrepTasksBoard(false)}
        {salaNotificacionesEnabled && salaTasksBoard}
        {canSeeProduction && crearOrdenButton('flex justify-center')}
        {canSeeCompras && pedidosPendientesCard}
        {canSeeAlerts && notificacionesCard}
        {canSeeRecipes && recetasCard}
        {canSeeEtiquetado && etiquetadoCard}
        {canSeeCompras && comprasCard}
      </div>

      {/* Bento Grid Content (escritorio) */}
      <div className="hidden md:grid md:grid-cols-12 gap-gutter mt-stack-xl">
        {/* Key Indicators Column */}
        <div className="md:col-span-4 space-y-gutter">
          {canSeeCompras && pedidosPendientesCard}
          {salaNotificacionesEnabled && salaTasksBoard}
          {canSeeAlerts && notificacionesCard}
        </div>

        {/* Main Task Board */}
        <div className="md:col-span-8 space-y-gutter">
          {canSeePrepTasks && renderPrepTasksBoard(true)}
        </div>
      </div>

      {/* Atmospheric Secondary Layer (escritorio) */}
      <section className="hidden md:grid mt-gutter md:grid-cols-3 gap-gutter">
        {canSeeRecipes && recetasCard}

        {canSeeEtiquetado ? (
          etiquetadoCard
        ) : (
          <div
            onClick={() => router.push('/dashboard/dashboard-interactivo')}
            className="tonal-layer-2 rounded-xl p-stack-lg border border-border border-dashed flex flex-col items-center justify-center gap-stack-md hover:border-secondary cursor-pointer hover:bg-surface-container-low transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant hover:text-secondary transition-colors">monitoring</span>
            <p className="font-label-md text-label-md text-on-surface-variant">Telemetría de Cocina en Vivo</p>
          </div>
        )}

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
    {postponingTask && (
      <PostponeTaskDialog
        task={postponingTask}
        open={Boolean(postponingTask)}
        onOpenChange={(open) => {
          if (!open) setPostponingTask(null);
        }}
      />
    )}
    <SalaTaskModal
      open={Boolean(editingSalaTask)}
      onOpenChange={(open) => {
        if (!open) setEditingSalaTask(null);
      }}
      task={editingSalaTask}
    />
    </>
  );
}