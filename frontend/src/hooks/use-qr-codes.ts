import { useState } from 'react';
import apiClient from '@/lib/api-client';

export interface GenerateQRCodeDto {
  entityType: 'digital-menu' | 'product' | 'recipe' | 'category';
  entityId: string;
  data?: Record<string, any>;
  config?: {
    qrType?: 'static' | 'dynamic' | 'temporary';
    format?: 'png' | 'svg' | 'jpeg' | 'webp';
    errorCorrection?: 'L' | 'M' | 'Q' | 'H';
    size?: number;
    foregroundColor?: string;
    backgroundColor?: string;
    margin?: number;
    includeLogo?: boolean;
    logoUrl?: string;
  };
}

export interface QRCodeResponse {
  qrCodeId: string;
  entityType: string;
  entityId: string;
  qrCodeUrl: string;
  publicUrl: string;
  format: string;
  size: number;
  publicFilePath: string;
  generatedAt: string;
  expiresAt?: string;
  scanCount?: number;
}

export interface QRScanResponse {
  qrCodeId: string;
  entityType: string;
  entityId: string;
  publicUrl: string;
  scanCount: number;
  lastScannedAt: string;
  format: string;
  size: number;
  entityData?: Record<string, any>;
}

export interface QRStats {
  total: number;
  active: number;
  expired: number;
  totalScans: number;
  topScanned: Array<{ qrCodeId: string; scanCount: number; entityId: string }>;
}

export function useQRCodes() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQRCode = async (dto: GenerateQRCodeDto): Promise<QRCodeResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<{ data: QRCodeResponse }>('/v1/qr/generate', dto);
      setIsLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  const getQRCode = async (qrCodeId: string): Promise<QRCodeResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: QRCodeResponse }>(`/v1/qr/${qrCodeId}`);
      setIsLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  const getQRCodesByEntity = async (
    entityType: string,
    entityId: string
  ): Promise<QRCodeResponse[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: QRCodeResponse[] }>(`/v1/qr/entity/${entityType}/${entityId}`);
      setIsLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  const registerScan = async (qrCodeId: string, deviceId?: string, userAgent?: string): Promise<QRScanResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<{ data: QRScanResponse }>('/v1/qr/scan', {
        qrCodeId,
        deviceId,
        userAgent,
      });
      setIsLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  const regenerateQRCode = async (qrCodeId: string, config?: GenerateQRCodeDto['config']): Promise<QRCodeResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<{ data: QRCodeResponse }>(`/v1/qr/regenerate/${qrCodeId}`, { config });
      setIsLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  const deleteQRCode = async (qrCodeId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/v1/qr/${qrCodeId}`);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  const getQRStats = async (entityType?: string, entityId?: string): Promise<QRStats> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entityType) params.append('entityType', entityType);
      if (entityId) params.append('entityId', entityId);

      const response = await apiClient.get<{ data: QRStats }>(`/v1/qr/stats?${params.toString()}`);
      setIsLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
      throw err;
    }
  };

  return {
    generateQRCode,
    getQRCode,
    getQRCodesByEntity,
    registerScan,
    regenerateQRCode,
    deleteQRCode,
    getQRStats,
    isLoading,
    error,
  };
}