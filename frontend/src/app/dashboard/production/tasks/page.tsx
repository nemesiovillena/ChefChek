'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useDashboardKPIs, useCompleteProductionTask } from '@/hooks/use-dashboard-kpis';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User, CheckCircle2, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ProductionTasksPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: kpis, isLoading } = useDashboardKPIs();
  const completeTask = useCompleteProductionTask();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const tasks = kpis?.upcomingProductionTasks ?? [];

  const handleComplete = async (e: React.MouseEvent, task: UpcomingProductionTask) => {
    e.stopPropagation();
    await completeTask.mutateAsync({ orderId: task.id, actualTime: task.estimatedTime ?? 0 });
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al dashboard
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tareas de preparación</h1>
        <p className="text-muted-foreground mt-1">{tasks.length} tarea(s) pendiente(s) o en curso</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay tareas de producción pendientes</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y">
            {tasks.map((task) => {
              const inProgress = task.status === 'IN_PROGRESS';
              const lotDate = new Date(task.lotDate);
              return (
                <div
                  key={task.id}
                  onClick={() => router.push(`/dashboard/production?batchId=${task.batchId}&orderId=${task.id}`)}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-2 h-10 rounded-full shrink-0 ${inProgress ? 'bg-secondary' : 'bg-primary'}`} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="h-3.5 w-3.5" />
                        {task.assignedStaffNames.length > 0 ? task.assignedStaffNames.join(', ') : 'Sin asignar'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {inProgress ? (
                      <Badge>En progreso</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {lotDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => handleComplete(e, task)}
                      disabled={completeTask.isPending}
                      title="Marcar tarea como completada"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
