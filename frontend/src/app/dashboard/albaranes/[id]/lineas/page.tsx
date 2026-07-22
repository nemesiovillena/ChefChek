'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useAlbaranDetail } from '@/hooks/use-albaran-detail';
import { confirmLine, rejectLine, updateStatus } from '@/lib/api-albaran';
import { LineMatchBadge } from '@/components/albaranes/line-match-badge';
import { AlbaranStatusBadge } from '@/components/albaranes/albaran-status-badge';
import { OcrMethodBadge } from '@/components/albaranes/ocr-method-badge';
import { LineActionsToolbar } from '@/components/albaranes/line-actions-toolbar';
import { ProductPickerDialog } from '@/components/albaranes/product-picker-dialog';
import { SupplierPickerDialog } from '@/components/albaranes/supplier-picker-dialog';
import { CreateProductInline } from '@/components/albaranes/create-product-inline';
import { AddLineForm } from '@/components/albaranes/add-line-form';
import { EditableLineCell } from '@/components/albaranes/editable-line-cell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, CheckCircle, XCircle, Package, Search, Plus, Check } from 'lucide-react';
import type { AlbaranLine, AlbaranStatus, LineStatus } from '@/lib/api-albaran';

export default function AlbaranLineasPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { albaran, loading, error, refetch } = useAlbaranDetail(id);
  const [updating, setUpdating] = useState<string | null>(null);
  const addNotification = useNotification();

  // Product picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<AlbaranLine | null>(null);

  // Inline product creation state
  const [creatingLine, setCreatingLine] = useState<string | null>(null);

  // Add manual line state
  const [showAddLine, setShowAddLine] = useState(false);

  // Albaran status transition (Marcar Revisado / Confirmar desde esta pestaña)
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);

  const handleAlbaranStatusChange = async (nextStatus: AlbaranStatus) => {
    setStatusUpdating(true);
    try {
      await updateStatus(id, nextStatus);
      refetch();
      addNotification({
        type: 'success',
        title: nextStatus === 'CONFIRMADO' ? 'Albarán confirmado' : 'Albarán revisado',
        message:
          nextStatus === 'CONFIRMADO'
            ? 'Stock actualizado y productos nuevos creados en el catálogo'
            : 'Ya puedes confirmar el albarán para asentar el stock',
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo actualizar',
        message: err instanceof Error ? err.message : 'Error al actualizar estado',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

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
      addNotification({
        type: 'error',
        title: 'No se pudo confirmar',
        message: err instanceof Error ? err.message : 'Error al confirmar línea',
      });
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
      addNotification({
        type: 'error',
        title: 'No se pudo rechazar',
        message: err instanceof Error ? err.message : 'Error al rechazar línea',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleOpenPicker = (line: AlbaranLine) => {
    setSelectedLine(line);
    setPickerOpen(true);
  };

  const handleOpenCreate = (line: AlbaranLine) => {
    setCreatingLine(line.id);
  };

  const handleCreateSuccess = () => {
    setCreatingLine(null);
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  /** Whether a line can be edited (only PENDIENTE lines) */
  const isEditable = (line: AlbaranLine) => line.lineStatus === 'PENDIENTE';

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

  const renderLineActions = (line: AlbaranLine) => {
    if (line.lineStatus === 'CONFIRMADO') {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <Check className="h-4 w-4" />
          <span className="text-xs">Confirmado</span>
        </div>
      );
    }

    if (line.lineStatus === 'RECHAZADO') {
      return (
        <span className="text-xs text-gray-400 line-through">Rechazado</span>
      );
    }

    // PENDIENTE lines - show actions based on matchStatus
    return (
      <div className="flex items-center gap-2">
        {line.matchStatus === 'MATCH_DUDOSO' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenPicker(line)}
            className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
          >
            <Search className="h-3 w-3 mr-1" />
            Elegir
          </Button>
        )}

        {line.matchStatus === 'NUEVO' && creatingLine !== line.id && (
          <>
            {/* Puede ser un existente que el OCR no casó: ofrecer vincular
                antes de crear un artículo paralelo (duplicado). */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenPicker(line)}
              className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
            >
              <Search className="h-3 w-3 mr-1" />
              Elegir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenCreate(line)}
              className="text-red-700 border-red-300 hover:bg-red-50"
            >
              <Plus className="h-3 w-3 mr-1" />
              Crear
            </Button>
          </>
        )}

        {line.matchStatus === 'MATCH_ALTO' && line.matchedProduct && (
          <div className="flex items-center gap-1 text-green-600">
            <Check className="h-4 w-4" />
            <span className="text-xs">Auto-match</span>
          </div>
        )}

        {/* Confirm/Reject buttons for all PENDIENTE lines */}
        {creatingLine !== line.id && (
          <div className="flex gap-1 ml-2">
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
      </div>
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
            <div className="flex flex-col items-end gap-2">
              <AlbaranStatusBadge status={albaran.status} />
              <OcrMethodBadge
                extractionMethod={albaran.ocrRawData?.extraction_method}
                extractionModel={albaran.ocrRawData?.extraction_model}
              />
            </div>
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
        <>
          <LineActionsToolbar
            albaranId={id}
            lines={lines}
            onRefresh={refetch}
          />

          {/* Add manual line button + form */}
          {(albaran.status === 'PENDIENTE' || albaran.status === 'REVISADO') && (
            <div className="mt-4">
              {showAddLine ? (
                <AddLineForm
                  albaranId={id}
                  onSuccess={() => { setShowAddLine(false); refetch(); }}
                  onCancel={() => setShowAddLine(false)}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddLine(true)}
                  className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir línea
                </Button>
              )}
            </div>
          )}

          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Lote</TableHead>
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
                      <Fragment key={line.id}>
                      <TableRow className={line.lineStatus === 'RECHAZADO' ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            {isEditable(line) ? (
                              <EditableLineCell
                                albaranId={id}
                                lineId={line.id}
                                field="description"
                                value={line.description}
                                className={`font-medium ${line.lineStatus === 'RECHAZADO' ? 'line-through' : ''}`}
                                onSave={refetch}
                              />
                            ) : (
                              <p className={`font-medium ${line.lineStatus === 'RECHAZADO' ? 'line-through' : ''}`}>
                                {line.description}
                              </p>
                            )}
                            {isEditable(line) && line.articleNumber ? (
                              <p className="text-xs text-gray-500">
                                Art:{' '}
                                <EditableLineCell
                                  albaranId={id}
                                  lineId={line.id}
                                  field="articleNumber"
                                  value={line.articleNumber}
                                  className="text-xs text-gray-500"
                                  onSave={refetch}
                                />
                              </p>
                            ) : line.articleNumber ? (
                              <p className="text-xs text-gray-500">Art: {line.articleNumber}</p>
                            ) : null}
                            {line.matchedProduct && (
                              <p className="text-xs text-indigo-600 mt-1">
                                → {line.matchedProduct.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditable(line) ? (
                            <EditableLineCell
                              albaranId={id}
                              lineId={line.id}
                              field="lot"
                              value={line.lot ?? ''}
                              onSave={refetch}
                            />
                          ) : (
                            line.lot || '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditable(line) ? (
                            <div className="flex items-center gap-1">
                              <EditableLineCell
                                albaranId={id}
                                lineId={line.id}
                                field="quantity"
                                value={line.quantity}
                                type="number"
                                step="0.01"
                                className="font-medium"
                                onSave={refetch}
                              />
                              <EditableLineCell
                                albaranId={id}
                                lineId={line.id}
                                field="unit"
                                value={line.unit}
                                suffix=""
                                className="text-gray-500"
                                onSave={refetch}
                              />
                            </div>
                          ) : (
                            <>
                              <span className="font-medium">{line.quantity}</span>
                              <span className="text-gray-500 ml-1">{line.unit}</span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditable(line) ? (
                            <EditableLineCell
                              albaranId={id}
                              lineId={line.id}
                              field="unitPrice"
                              value={line.unitPrice}
                              type="number"
                              step="0.001"
                              format={(v) => formatCurrency(Number(v))}
                              onSave={refetch}
                            />
                          ) : (
                            formatCurrency(line.unitPrice)
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditable(line) ? (
                            <EditableLineCell
                              albaranId={id}
                              lineId={line.id}
                              field="vatPercent"
                              value={line.vatPercent}
                              type="number"
                              step="1"
                              suffix="%"
                              onSave={refetch}
                            />
                          ) : (
                            `${line.vatPercent}%`
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // lineAmount = bruto (qty × precio). totalPrice = neto
                            // del papel (con descuento). Mostramos el neto cuando
                            // el proveedor aplicó descuento y no cuadra con el bruto.
                            const gross = line.lineAmount;
                            const net = line.totalPrice;
                            const hasNet =
                              net !== null && Math.abs(net - gross) > 0.005;
                            const isDiscount = hasNet && net! < gross && gross > 0;
                            if (!hasNet) {
                              return (
                                <span className="font-semibold">
                                  {formatCurrency(gross)}
                                </span>
                              );
                            }
                            const discountPct = isDiscount
                              ? Math.round((1 - (net! / gross)) * 1000) / 10
                              : 0;
                            return (
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold">
                                  {formatCurrency(net!)}
                                </span>
                                {isDiscount && (
                                  <>
                                    <span className="text-xs text-gray-400 line-through">
                                      {formatCurrency(gross)}
                                    </span>
                                    <span className="text-[10px] font-medium text-emerald-700">
                                      −{discountPct}% dto
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <LineMatchBadge matchStatus={line.matchStatus} confidence={line.confidence} />
                        </TableCell>
                        <TableCell>{getLineStatusBadge(line.lineStatus)}</TableCell>
                        <TableCell>{renderLineActions(line)}</TableCell>
                      </TableRow>
                      {creatingLine === line.id && (
                        <TableRow>
                          {/* Fila a ancho completo: el formulario (varios campos por fila)
                              no cabe en la columna "Acciones" sin solaparse. */}
                          <TableCell colSpan={9} className="bg-gray-50 p-0">
                            <CreateProductInline
                              albaranId={id}
                              line={line}
                              supplierId={albaran?.supplierId}
                              onSuccess={handleCreateSuccess}
                              onCancel={() => setCreatingLine(null)}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Avance de estado sin volver al Resumen: aparece cuando ya no
              quedan líneas pendientes de confirmar/rechazar. Sin proveedor
              asignado se bloquea: los productos/ofertas nacerían huérfanos. */}
          {pendingCount === 0 &&
            (albaran.status === 'PENDIENTE' || albaran.status === 'REVISADO') &&
            (!albaran.supplier ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800 flex-1">
                  Todas las líneas están revisadas, pero el albarán no tiene proveedor
                  asignado. Asígnalo antes de continuar para que los precios y los
                  productos nuevos queden vinculados a él.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSupplierPickerOpen(true)}
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  Asignar proveedor
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 flex-1">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-800">
                    {albaran.status === 'PENDIENTE'
                      ? 'Todas las líneas están revisadas. Puedes marcar el albarán como revisado.'
                      : `Albarán revisado. Al confirmarlo se actualizará el stock y los precios de ${albaran.supplier.name}.`}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    handleAlbaranStatusChange(
                      albaran.status === 'PENDIENTE' ? 'REVISADO' : 'CONFIRMADO',
                    )
                  }
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {statusUpdating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {albaran.status === 'PENDIENTE' ? 'Marcar Revisado' : 'Confirmar Albarán'}
                </Button>
              </div>
            ))}
        </>
      )}

      {/* Product Picker Dialog */}
      {selectedLine && (
        <ProductPickerDialog
          key={selectedLine.id}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          albaranId={id}
          line={selectedLine}
          onSuccess={refetch}
        />
      )}

      {/* Supplier Picker (desde el aviso de proveedor sin asignar) */}
      <SupplierPickerDialog
        open={supplierPickerOpen}
        onOpenChange={setSupplierPickerOpen}
        albaranId={id}
        currentSupplierId={albaran?.supplier?.id}
        onSuccess={refetch}
      />
    </div>
  );
}
