import { Request as ExpressRequest } from "express";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface AuthenticatedRequest extends ExpressRequest {
  user?: AuthUser;
  sessionId?: string;
}

export interface TenantRequest extends ExpressRequest {
  tenantId?: string;
  tenantSlug?: string;
}
