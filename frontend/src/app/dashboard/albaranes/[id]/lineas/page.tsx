'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useAlbaranDetail } from '@/hooks/use-albaran-detail';
import { confirmLine, rejectLine, updateStatus, updateAlbaran, matchLine as assignMatchedProduct, dismissSuggestion } from '@/lib/api-albaran';
import { LineMatchBadge } from '@/components/albaranes/line-match-badge';
import { LinePriceChangeBadge } from '@/components/albaranes/line-price-change-badge';
import { AlbaranStatusBadge } from '@/components/albaranes/albaran-status-badge';
import { OcrMethodBadge } from '@/components/albaranes/ocr-method-badge';
import { LineActionsToolbar } from '@/components/albaranes/line-actions-toolbar';
import { ProductPickerDialog } from '@/components/albaranes/product-picker-dialog';
import { SupplierPickerDialog } from '@/components/albaranes/supplier-picker-dialog';
import { CreateProductInline } from '@/components/albaranes/create-product-inline';
import { AddLineForm } from '@/components/albaranes/add-line-form';
import { EditableLineCell } from '@/components/albaranes/editable-line-cell';
import { CorrectPriceDialog } from '@/components/albaranes/correct-price-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, CheckCircle, XCircle, Package, Search, Plus, Check, X, Clock, Pencil } from 'lucide-react';
import type { AlbaranLine, AlbaranStatus, LineStatus } from '@/lib/api-albaran';

export default function AlbaranLineasPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  // Si se llegó desde un Pedido (ver ReceptionSection), "Confirmar" y "Volver"
  // deben regresar allí en vez de al listado de Albaranes por defecto.
  const returnTo = searchParams.get('returnTo');
  const backHref = returnTo || '/dashboard/albaranes';
  const backLabel = returnTo ? 'Volver al Pedido' : 'Volver a Albaranes';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { albaran, loading, error, refetch } = useAlbaranDetail(id);
  const [updating, setUpdating] = useState<string | null>(null);
  const addNotification = useNotification();
  const queryClient = useQueryClient();

  // Product picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<AlbaranLine | null>(null);

  // Inline product creation state
  const [creatingLine, setCreatingLine] = useState<string | null>(null);

  // Add manual line state
  const [showAddLine, setShowAddLine] = useState(false);

  // Corrección de precio post-confirmación: la línea abierta + un seq para
  // el key-reset (remonta el diálogo y rehidrata los drafts en cada apertura).
  const [correction, setCorrection] = useState<{ line: AlbaranLine; seq: number } | null>(null);

  // Albaran status transition (Marcar Revisado / Confirmar desde esta pestaña)
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);

  // Mismo toggle "aplicar descuento al coste" que la pestaña Resumen, pero
  // aquí también: si el usuario confirma desde el CTA de Líneas (el camino
  // más natural tras revisar las líneas) sin haber pasado por Resumen, nunca
  // veía la opción y el descuento del papel no se aplicaba al coste sin que
  // lo decidiera. Mismo mutex: deshabilitado si algún producto ya vinculado
  // tiene descuento fijo propio (se duplicaría).
  const hasStandingDiscount = (albaran?.lines ?? []).some(
    (l) => (l.matchedProduct?.discountPercentage ?? 0) > 0,
  );
  const hasLineDiscount = (albaran?.lines ?? []).some(
    (l) =>
      l.totalPrice !== null &&
      l.totalPrice < l.lineAmount &&
      Math.abs(l.totalPrice - l.lineAmount) > 0.005,
  );

  const handleToggleDiscount = async (checked: boolean) => {
    setStatusUpdating(true);
    try {
      await updateAlbaran(id, { applyDiscountToCost: checked });
      void queryClient.invalidateQueries({ queryKey: ['albaran', id] });
      refetch();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo actualizar',
        message: err instanceof Error ? err.message : 'Error al actualizar el albarán',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAlbaranStatusChange = async (nextStatus: AlbaranStatus) => {
    setStatusUpdating(true);
    try {
      await updateStatus(id, nextStatus);
      // El estado cambió en BD: invalida la caché del listado Y del detalle
      // (staleTime global 5min) para que tanto el badge del listado como el
      // propio detalle (si se reabre este albarán) muestren el estado nuevo
      // en vez de servir el snapshot congelado de antes de confirmar — sin
      // esto el CTA "Confirmar Albarán" seguía apareciendo tras confirmar.
      void queryClient.invalidateQueries({ queryKey: ['albaranes'] });
      void queryClient.invalidateQueries({ queryKey: ['albaran', id] });
      addNotification({
        type: 'success',
        title: nextStatus === 'CONFIRMADO' ? 'Albarán confirmado' : 'Albarán revisado',
        message:
          nextStatus === 'CONFIRMADO'
            ? 'Stock actualizado y productos nuevos creados en el catálogo'
            : 'Ya puedes confirmar el albarán para asentar el stock',
      });
      // Confirmado = fin del flujo de revisión: vuelve directo al listado (o
      // al Pedido si llegó desde allí; paridad con la pestaña Resumen) en vez
      // de dejar al usuario varado en Líneas con que tenga que navegar
      // manualmente.
      if (nextStatus === 'CONFIRMADO') {
        router.push(backHref);
        return;
      }
      refetch();
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

  const handleAcceptSuggestion = async (line: AlbaranLine) => {
    if (!line.suggestedProductId) return;
    setUpdating(line.id);
    try {
      await assignMatchedProduct(id, line.id, line.suggestedProductId);
      refetch();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo asignar',
        message: err instanceof Error ? err.message : 'Error al asignar la sugerencia',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleDismissSuggestion = async (line: AlbaranLine) => {
    setUpdating(line.id);
    try {
      await dismissSuggestion(id, line.id);
      refetch();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo descartar',
        message: err instanceof Error ? err.message : 'Error al descartar la sugerencia',
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

  /** Corrección de precio: solo en albaranes confirmados, líneas confirmadas
   *  con artículo vinculado (sin artículo no hay coste que re-sincronizar). */
  const canCorrectPrice = (line: AlbaranLine) =>
    albaran?.status === 'CONFIRMADO' &&
    line.lineStatus === 'CONFIRMADO' &&
    !!line.matchedProduct;

  const getLineStatusBadge = (status: LineStatus) => {
    // Badge de solo icono (con tooltip) en vez de texto: la palabra completa
    // ("Pendiente"/"Confirmado"/"Rechazado") era una de las columnas que más
    // ensanchaba la fila y la sacaba del viewport en iPad.
    const config: Record<LineStatus, { icon: typeof Clock; className: string; label: string }> = {
      PENDIENTE: { icon: Clock, className: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
      CONFIRMADO: { icon: Check, className: 'bg-green-100 text-green-800', label: 'Confirmado' },
      RECHAZADO: { icon: X, className: 'bg-red-100 text-red-800', label: 'Rechazado' },
    };
    const { icon: Icon, className, label } = config[status];
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${className}`}
        title={label}
        aria-label={label}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  };

  const renderLineActions = (line: AlbaranLine) => {
    // Sin texto para estados terminales: la columna Estado ya lo muestra
    // (icono con tooltip) y repetirlo aquí era la causa principal de que la
    // fila no cupiera entera en iPad.
    if (line.lineStatus === 'CONFIRMADO' || line.lineStatus === 'RECHAZADO') {
      return <span className="text-gray-300">—</span>;
    }

    // PENDIENTE lines - show actions based on matchStatus. Icon-only (con
    // title) y en grid de 2 columnas: en MATCH_DUDOSO/NUEVO caben hasta 4
    // botones (Elegir/Crear + Confirmar/Rechazar) en la misma celda, y en
    // fila única no cabían en el viewport de iPad.
    return (
      <div className="grid grid-cols-2 gap-1 w-fit">
        {(line.matchStatus === 'MATCH_DUDOSO' || line.matchStatus === 'NUEVO') &&
          creatingLine !== line.id && (
            <>
              {/* Puede ser un existente que el OCR no casó (o casó mal): ofrecer
                  vincular antes de crear un artículo paralelo (duplicado). */}
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleOpenPicker(line)}
                title="Elegir artículo existente"
                className={
                  line.matchStatus === 'MATCH_DUDOSO'
                    ? 'text-yellow-700 border-yellow-300 hover:bg-yellow-50'
                    : 'text-indigo-700 border-indigo-300 hover:bg-indigo-50'
                }
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleOpenCreate(line)}
                title="Crear artículo nuevo"
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

        {/* Confirm/Reject buttons for all PENDIENTE lines */}
        {creatingLine !== line.id && (
          <>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => handleConfirmLine(line.id)}
              disabled={updating === line.id}
              title="Confirmar línea"
              className="text-green-600 hover:bg-green-50"
            >
              {updating === line.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => handleRejectLine(line.id)}
              disabled={updating === line.id}
              title="Rechazar línea"
              className="text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </>
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
      <Button variant="ghost" onClick={() => router.push(backHref)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
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
                      <TableHead>Variación</TableHead>
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
                            {/* Candidato de baja confianza (MATCH_DUDOSO o NUEVO): antes se
                                calculaba y se tiraba sin mostrar nada. Aceptar reutiliza el
                                mismo endpoint que "Elegir"; descartar persiste (no vuelve a
                                aparecer en un re-match del mismo documento). */}
                            {!line.matchedProduct &&
                              line.suggestedProduct &&
                              !line.suggestionDismissed &&
                              isEditable(line) && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                                  <span>¿Es &quot;{line.suggestedProduct.name}&quot;?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptSuggestion(line)}
                                    disabled={updating === line.id}
                                    className="rounded p-0.5 text-green-600 hover:bg-green-50"
                                    title="Usar este artículo"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDismissSuggestion(line)}
                                    disabled={updating === line.id}
                                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    title="No es este artículo"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
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
                          ) : canCorrectPrice(line) ? (
                            // Precio ya asentado: mismo gesto que la edición
                            // inline (lápiz sobre el valor), pero abre el
                            // diálogo de corrección — cambia coste, oferta e
                            // histórico, no es una edición silenciosa.
                            <span
                              className="group cursor-pointer inline-flex items-center gap-1"
                              onClick={() => setCorrection({ line, seq: Date.now() })}
                              title="Corregir precio asentado"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setCorrection({ line, seq: Date.now() });
                                }
                              }}
                            >
                              {formatCurrency(line.unitPrice)}
                              <Pencil className="h-3 w-3 text-amber-500 opacity-70 transition-opacity group-hover:opacity-100" />
                            </span>
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
                          {(() => {
                            if (!line.matchedProduct) return null;
                            const lineQuantity = Number(line.quantity);
                            const effectivePrice =
                              albaran?.applyDiscountToCost && line.totalPrice !== null && lineQuantity > 0
                                ? line.totalPrice / lineQuantity
                                : line.unitPrice;
                            return (
                              <LinePriceChangeBadge
                                effectivePrice={effectivePrice}
                                previousPrice={line.matchedProduct.purchasePrice}
                              />
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
                          <TableCell colSpan={10} className="bg-gray-50 p-0">
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
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                {hasLineDiscount && (
                  <label
                    className={`flex items-start gap-2 text-xs text-green-800 ${
                      hasStandingDiscount ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    }`}
                    title={
                      hasStandingDiscount
                        ? 'Uno o más artículos tienen descuento fijo: aplicarlo al coste duplicaría el descuento. Quítalo de esos artículos para usar esta opción.'
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-green-300"
                      checked={!!albaran.applyDiscountToCost}
                      disabled={statusUpdating || hasStandingDiscount}
                      onChange={(e) => handleToggleDiscount(e.target.checked)}
                    />
                    <span>
                      {hasStandingDiscount ? (
                        <>No se puede aplicar el descuento al <strong>coste</strong>: uno o más artículos tienen descuento fijo y se duplicaría.</>
                      ) : (
                        <>Aplicar el descuento del papel al <strong>coste</strong> al confirmar: el precio de compra y los escandallos usarán el neto en vez del bruto.</>
                      )}
                    </span>
                  </label>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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

      {/* Corrección de precio de una línea ya confirmada */}
      {correction && (
        <CorrectPriceDialog
          key={`${correction.line.id}-${correction.seq}`}
          open
          onOpenChange={(v) => {
            if (!v) setCorrection(null);
          }}
          albaran={albaran}
          line={correction.line}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
