import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export type TaskType = 'PREPARATION' | 'COOKING' | 'PLATING' | 'QUALITY_CHECK';

export interface TaskAssignment {
  id: string;
  taskId: string;
  orderId: string;
  staffMemberId: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  assignedAt: string;
  completedAt?: string | null;
  actualTime?: number | null;
}

export interface ProductionTask {
  id: string;
  orderId: string;
  title: string;
  taskType: TaskType;
  estimatedTime: number;
  dependencies: string[];
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  assignments: TaskAssignment[];
}

export interface CreateProductionTaskInput {
  orderId: string;
  title: string;
  taskType: TaskType;
  estimatedTime: number;
}

/** Tareas de una orden de producción, cada una con sus asignaciones de
 * personal ya incluidas (`assignments`), para no tener que cruzar dos listas
 * en el cliente. */
export function useProductionTasks(orderId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['production-tasks', orderId],
    queryFn: async () => {
      const response = await apiClient.get<ProductionTask[]>(
        `/v1/production/orders/${orderId}/tasks`,
      );
      return response.data;
    },
    enabled: !!orderId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-tasks', orderId] });
    queryClient.invalidateQueries({ queryKey: ['production-staff'] });
    queryClient.invalidateQueries({ queryKey: ['production-staff-available'] });
  };

  const createTask = useMutation({
    mutationFn: async (input: CreateProductionTaskInput) => {
      const response = await apiClient.post<ProductionTask>('/v1/production/tasks', input);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const assignStaff = useMutation({
    mutationFn: async ({ taskId, assignedTo }: { taskId: string; assignedTo: string }) => {
      const response = await apiClient.post<TaskAssignment>('/v1/production/assignments', {
        orderId,
        taskId,
        assignedTo,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const completeAssignment = useMutation({
    mutationFn: async ({ assignmentId, actualTime }: { assignmentId: string; actualTime: number }) => {
      const response = await apiClient.put(`/v1/production/assignments/${assignmentId}`, {
        status: 'COMPLETED',
        actualTime,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  return {
    tasks: data || [],
    isLoading,
    createTask: createTask.mutateAsync,
    isCreatingTask: createTask.isPending,
    assignStaff: assignStaff.mutateAsync,
    isAssigning: assignStaff.isPending,
    completeAssignment: completeAssignment.mutateAsync,
  };
}
