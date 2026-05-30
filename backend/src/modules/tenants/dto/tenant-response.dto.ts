export class TenantResponseDto {
  success: true;
  data: {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  message: string;
}

export class TenantsListResponseDto {
  success: true;
  data: Array<{
    id: string;
    name: string;
    slug: string;
    domain?: string;
    isActive: boolean;
    createdAt: Date;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
  };
  message: string;
}