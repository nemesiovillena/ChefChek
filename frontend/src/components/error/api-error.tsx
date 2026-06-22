'use client';

import { AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';
import { ReactNode } from 'react';

interface ApiErrorProps {
  message: string;
  statusCode?: number;
  onRetry?: () => void;
  helpLink?: string;
  requestId?: string;
  children?: ReactNode;
}

export default function ApiError({
  message,
  statusCode,
  onRetry,
  helpLink,
  requestId,
  children,
}: ApiErrorProps) {
  const isServerError = statusCode && statusCode >= 500;
  const isClientError = statusCode && statusCode >= 400 && statusCode < 500;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {isServerError ? 'Error del servidor' : isClientError ? 'Error de cliente' : 'Error'}
          </h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>

          {requestId && (
            <p className="mt-1 text-xs text-red-600">
              ID de solicitud: {requestId}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <RefreshCw className="h-3 w-3" />
                Reintentar
              </button>
            )}

            {helpLink && (
              <a
                href={helpLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <HelpCircle className="h-3 w-3" />
                Ayuda
              </a>
            )}
          </div>
        </div>
      </div>

      {children && <div className="mt-3 pt-3 border-t border-red-200">{children}</div>}
    </div>
  );
}