'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useProductionTasks, type TaskType } from '@/hooks/use-production-tasks';
import { useAvailableStaff } from '@/hooks/use-production-staff';

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'PREPARATION', label: 'Preparación' },
  { value: 'COOKING', label: 'Cocción' },
  { value: 'PLATING', label: 'Emplatado' },
  { value: 'QUALITY_CHECK', label: 'Control de calidad' },
];

interface OrderTasksPanelProps {
  orderId: string;
}

export default function OrderTasksPanel({ orderId }: OrderTasksPanelProps) {
  const confirm = useConfirm();
  const { tasks, isLoading, createTask, isCreatingTask, assignStaff, completeAssignment } =
    useProductionTasks(orderId);
  const { availableStaff } = useAvailableStaff();
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('PREPARATION');
  const [estimatedTime, setEstimatedTime] = useState('');

  const canCreateTask = title.trim() !== '' && estimatedTime.trim() !== '';

  const handleCompleteAssignment = async (assignmentId: string) => {
    let actualTime = 0;
    const ok = await confirm({
      title: 'Completar tarea',
      description: 'Introduce el tiempo real empleado.',
      children: (
        <Input
          type="number"
          min="0"
          autoFocus
          placeholder="Minutos"
          onChange={(e) => {
            actualTime = Number(e.target.value);
          }}
        />
      ),
    });
    if (!ok || !Number.isFinite(actualTime) || actualTime <= 0) return;
    await completeAssignment({ assignmentId, actualTime });
  };

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-semibold">Tareas y personal asignado</h5>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin tareas todavía.</p>
        ) : (
          tasks.map((task) => {
            const activeAssignment = task.assignments.find((a) => a.status !== 'COMPLETED');
            const taskId = task.id;
            const handleAssign = (staffId: string | null) => {
              if (staffId) assignStaff({ taskId, assignedTo: staffId });
            };
            return (
              <div key={task.id} className="rounded border p-2 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{task.title}</span>
                  <Badge variant="secondary">{task.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {TASK_TYPE_OPTIONS.find((o) => o.value === task.taskType)?.label} · {task.estimatedTime} min
                </div>
                {activeAssignment ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Asignada</span>
                    {activeAssignment.status !== 'COMPLETED' && (
                      <Button size="sm" variant="ghost" onClick={() => handleCompleteAssignment(activeAssignment.id)}>
                        Completar
                      </Button>
                    )}
                  </div>
                ) : (
                  <Select onValueChange={handleAssign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar a..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStaff.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name} ({staff.assignedTasks}/{staff.maxTasks})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input placeholder="Título de la tarea" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="w-40">
          <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-20">
          <Input
            type="number"
            min="0"
            placeholder="Min."
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!canCreateTask || isCreatingTask}
          onClick={async () => {
            await createTask({ orderId, title, taskType, estimatedTime: Number(estimatedTime) });
            setTitle('');
            setEstimatedTime('');
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
