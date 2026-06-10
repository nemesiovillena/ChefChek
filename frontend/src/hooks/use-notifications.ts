import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface NotificationResponse {
  id: string;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  recipientId?: string;
  recipientName?: string;
  createdAt: string;
  readAt?: string;
}

export interface CreateNotificationData {
  title: string;
  content: string;
  type: string;
  recipientId?: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiClient.get<NotificationResponse[]>('/v1/notifications');
      return response.data;
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (data: CreateNotificationData) => {
      const response = await apiClient.post<NotificationResponse>('/v1/notifications', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<NotificationResponse>(`/v1/notifications/${id}`, { isRead: true });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: data || [],
    isLoading,
    error,
    refetch,
    createNotification: createNotificationMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
    isCreating: createNotificationMutation.isPending,
  };
}