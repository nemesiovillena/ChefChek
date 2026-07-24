'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ALBARAN_UPLOAD_URL } from '@/lib/upload-api';

export interface DetectedProduct {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  confidence: number;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
}

export interface AlbaranUploadResult {
  products: DetectedProduct[];
}

export interface UseAlbaranUploadOptions {
  /** AI model for structured extraction */
  aiModel?: string;
  /** AI API key (stored in sessionStorage, never persisted in backend) */
  aiApiKey?: string;
}

const MAX_FILES = 10;

/** Build auth headers from session storage for direct backend calls */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const sessionId = sessionStorage.getItem('session_id');
  const headers: Record<string, string> = {};
  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }
  const tenantSlug = sessionStorage.getItem('tenant_slug');
  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug;
  }
  return headers;
}

/** Extract error message from API response (handles both proxy and direct responses) */
async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      const errorData = await response.json();
      return errorData.error?.message || errorData.message || fallback;
    } catch {
      return 'Error de respuesta del servidor';
    }
  }
  const errorText = await response.text();
  return errorText.slice(0, 200) || fallback;
}

export function useAlbaranUpload(options: UseAlbaranUploadOptions = {}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [results, setResults] = useState<AlbaranUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (droppedFiles.length === 0) {
      setError('Solo se permiten imágenes (JPG, PNG) o PDF');
      return;
    }
    setFiles((prev) => {
      const combined = [...prev, ...droppedFiles];
      return combined.slice(0, MAX_FILES);
    });
    setResults(null);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      if (selected.length === 0) {
        setError('Solo se permiten imágenes (JPG, PNG) o PDF');
        return;
      }
      setFiles((prev) => {
        const combined = [...prev, ...selected];
        return combined.slice(0, MAX_FILES);
      });
      setResults(null);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults(null);
  }, []);

  /** Process files through the Python OCR microservice */
  const processFiles = useCallback(async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(10);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('file', file));

      // Añadir modelo IA y API key si están configurados
      const model = options.aiModel;
      const apiKey = options.aiApiKey;
      if (model && model !== 'regex') {
        formData.append('ai_model', model);
        if (apiKey) {
          formData.append('ai_api_key', apiKey);
        }
      }

      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch(ALBARAN_UPLOAD_URL, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
      });

      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response, 'Error procesando albarán');
        throw new Error(errorMessage);
      }

      const data: AlbaranUploadResult & { albaran?: { id: string }; albaranId?: string } = await response.json();

      // If the response includes an albaran (new flow), store the ID for redirect
      if (data.albaran?.id) {
        data.albaranId = data.albaran.id;
      }

      if (!data.products || data.products.length === 0) {
        throw new Error('No se detectaron productos en el albarán');
      }

      if (data.albaranId) {
        void queryClient.invalidateQueries({ queryKey: ['albaranes'] });
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error processing files:', err);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [files, options.aiApiKey, options.aiModel, queryClient]);

  /** Reset all state */
  const reset = useCallback(() => {
    setFiles([]);
    setResults(null);
    setError(null);
  }, []);

  return {
    // Refs
    fileInputRef,
    // State
    files,
    isDragging,
    isUploading,
    uploadProgress,
    results,
    error,
    // Handlers
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    removeFile,
    processFiles,
    reset,
  };
}
