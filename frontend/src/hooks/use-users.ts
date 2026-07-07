import { useCrud as createCrudHooks, useApiMutation } from './use-api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
  isActive: boolean;
  avatarUrl?: string;
  street?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  payrollEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  tenantId: string;
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'USER' | 'VIEWER';
  isActive?: boolean;
  avatarUrl?: string;
  street?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  payrollEmail?: string;
}

export interface UpdateUserData extends Partial<Omit<CreateUserData, 'tenantId'>> {
  id: string;
}

const { useList, useGet, useCreate, useUpdate, useDelete } =
  createCrudHooks<User, CreateUserData, UpdateUserData>('/v1/users', ['users']);

export function useUsers(page: number = 1, pageSize: number = 50) {
  return useList(page, pageSize);
}

export function useUser(id: string) {
  return useGet(id);
}

export function useCreateUser() {
  return useCreate();
}

export function useUpdateUser() {
  return useUpdate();
}

export function useDeleteUser() {
  return useDelete();
}

export function useUploadUserAvatar() {
  return useApiMutation<{ avatarUrl: string }, FormData>(
    '/v1/users/upload-avatar',
    'POST'
  );
}
