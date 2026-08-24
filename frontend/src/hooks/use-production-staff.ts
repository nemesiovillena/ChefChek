import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface StaffMember {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  email?: string | null;
  isActive: boolean;
  availableHours: number;
  maxTasks: number;
  assignedTasks: number;
  completedTasks: number;
}

export interface CreateStaffMemberInput {
  name: string;
  role: string;
  email?: string;
  availableHours?: number;
  maxTasks?: number;
}

export interface UpdateStaffMemberInput {
  name?: string;
  role?: string;
  email?: string;
  isActive?: boolean;
  availableHours?: number;
  maxTasks?: number;
}

export function useStaffMembers() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['production-staff'],
    queryFn: async () => {
      const response = await apiClient.get<StaffMember[]>('/v1/production/staff');
      return response.data;
    },
  });

  const createStaffMember = useMutation({
    mutationFn: async (input: CreateStaffMemberInput) => {
      const response = await apiClient.post<StaffMember>('/v1/production/staff', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-staff'] });
    },
  });

  const updateStaffMember = useMutation({
    mutationFn: async ({ staffId, input }: { staffId: string; input: UpdateStaffMemberInput }) => {
      const response = await apiClient.put<StaffMember>(`/v1/production/staff/${staffId}`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-staff'] });
      queryClient.invalidateQueries({ queryKey: ['production-staff-available'] });
    },
  });

  return {
    staff: data || [],
    isLoading,
    error,
    createStaffMember: createStaffMember.mutateAsync,
    isCreating: createStaffMember.isPending,
    updateStaffMember: updateStaffMember.mutateAsync,
    isUpdating: updateStaffMember.isPending,
  };
}

export function useAvailableStaff() {
  const { data, isLoading } = useQuery({
    queryKey: ['production-staff-available'],
    queryFn: async () => {
      const response = await apiClient.get<StaffMember[]>('/v1/production/staff/available');
      return response.data;
    },
  });

  return { availableStaff: data || [], isLoading };
}
