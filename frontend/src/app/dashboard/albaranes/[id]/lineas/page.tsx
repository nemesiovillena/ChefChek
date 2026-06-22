'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useAlbaranDetail } from '@/hooks/use-albaran-detail';
import { confirmLine, rejectLine } from '@/lib/api-albaran';
import { LineMatchBadge } from '@/components/albaranes/line-match-badge';
import { AlbaranStatusBadge } from '@/components/albaranes/albaran-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, CheckCircle, XCircle, Package } from 'lucide-react';
import type { AlbaranLine, LineStatus } from '@/lib/api-albaran';

export default function AlbaranLineasPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { albaran, loading, error, refetch } = useAlbaranDetail(id);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleConfirmLine = async (lineId: string) => {
    setUpdating(lineId);
    try {
      await confirmLine(id, lineId);
      refetch();
    } catch (err) {
      console.error('Error confirming line:', err);
      alert(err instanceof Error ? err.message : 'Error al confirmar línea');
    } finally {
      setUpdating(null);
    }
  };

  const handleRejectLine = async (lineId: string) => {
    setUpdating(lineId);
    try {
      await rejectLine(id, lineId);
      refetch();
    } catch (err) {
      console.error('Error rejecting line:', err);
      alert(err instanceof Error ? err.message : 'Error al rechazar línea');
    } finally {
      setUpdating(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getLineStatusBadge = (status: LineStatus) => {
    const config: Record<LineStatus, { label: string; className: string }> = {
      PENDIENTE: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
      CONFIRMADO: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
      RECHAZADO: { label: 'Rechazado', className: 'bg-red-100 text-red-800' },
    };
    return (
      <Badge variant="secondary" className={config[status].className}>
        {config[status].label}
      </Badge>
    );
  };

  if (authLoading || !isAuthenticated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !albaran) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Albarán no encontrado'}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  const lines = albaran.lines || [];
  const confirmedCount = lines.filter((l) => l.lineStatus === 'CONFIRMADO').length;
  const pendingCount = lines.filter((l) => l.lineStatus === 'PENDIENTE').length;
  const rejectedCount = lines.filter((l) => l.lineStatus === 'RECHAZADO').length;

  return (
    <div>
      <Button variant="ghost" onClick={() => router.push('/dashboard/albaranes')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Albaranes
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Líneas del Albarán {albaran.albaranNumber || 'Sin número'}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {albaran.supplier?.name} - {lines.length} líneas totales
              </p>
            </div>
            <AlbaranStatusBadge status={albaran.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span>{pendingCount} pendientes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>{confirmedCount} confirmadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>{rejectedCount} rechazadas</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {lines.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin líneas</h3>
          <p className="text-gray-600">Este albarán no tiene líneas registradas</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>IVA</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{line.description}</p>
                          {line.articleNumber && (
                            <p className="text-xs text-gray-500">Art: {line.articleNumber}</p>
                          )}
                          {line.matchedProduct && (
                            <p className="text-xs text-indigo-600 mt-1">
                              → {line.matchedProduct.name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{line.quantity}</span>
                        <span className="text-gray-500 ml-1">{line.unit}</span>
                      </TableCell>
                      <TableCell>{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell>{line.vatPercent}%</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(line.lineAmount)}</TableCell>
                      <TableCell>
                        <LineMatchBadge matchStatus={line.matchStatus} confidence={line.confidence} />
                      </TableCell>
                      <TableCell>{getLineStatusBadge(line.lineStatus)}</TableCell>
                      <TableCell>
                        {line.lineStatus === 'PENDIENTE' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmLine(line.id)}
                              disabled={updating === line.id}
                              className="text-green-600 hover:bg-green-50"
                            >
                              {updating === line.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectLine(line.id)}
                              disabled={updating === line.id}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
