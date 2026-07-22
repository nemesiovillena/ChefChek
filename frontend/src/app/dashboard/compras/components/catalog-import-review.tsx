'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, X, Loader2, CircleAlert, CircleCheck, HelpCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { formatEuro } from '@/lib/utils';
import {
  useCatalogImport,
  useUpdateCatalogImportLine,
  useApplyCatalogImport,
  useDiscardCatalogImport,
  useDeleteCatalogImport,
  type CatalogImportLine,
  type CatalogLineStatus,
} from '@/hooks/use-catalog-imports';
import { ProductSearchInput } from './product-search-input';

const MATCH_BADGE: Record<CatalogImportLine['matchStatus'], { label: string; icon: typeof CircleCheck; className: string }> = {
  MATCH_ALTO: { label: 'Coincide', icon: CircleCheck, className: 'text-[var(--primary)]' },
  MATCH_DUDOSO: { label: 'Dudoso', icon: HelpCircle, className: 'text-[var(--on-surface-variant)]' },
  NUEVO: { label: 'Sin artículo', icon: CircleAlert, className: 'text-[var(--error)]' },
};

/** Normaliza para comparar strings de formato de compra ("Caja 5kg" vs "caja 5 kg"). */
const normalizeFormat = (s: string | null | undefined) =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Comparación de precios contra el artículo ya emparejado. El catálogo solo
 * trae un `purchaseFormat` de texto libre (sin tamaño de envase estructurado
 * como sí tiene Product/ProductSupplierOffer), así que solo se calcula un %
 * cuando el formato coincide literalmente con el del artículo — si no, se
 * muestran ambos precios sin inventar una comparación inválida entre
 * formatos distintos.
 */
function PriceComparison({ line }: { line: CatalogImportLine }) {
  const product = line.matchedProduct;
  if (!product) return null;

  const productRefPrice = product.purchasePrice / (product.unitSize || 1);
  const sameFormat =
    !!product.purchaseFormat &&
    !!line.purchaseFormat &&
    normalizeFormat(product.purchaseFormat) === normalizeFormat(line.purchaseFormat);

  const deltaPct = sameFormat && product.purchasePrice > 0
    ? ((line.unitPrice - product.purchasePrice) / product.purchasePrice) * 100
    : null;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--on-surface-variant)]">
      <span>
        Tu precio actual: <span className="font-medium text-[var(--on-surface)]">{formatEuro(productRefPrice)}/{product.referenceUnit}</span>
        {product.purchaseFormat && ` (${product.purchaseFormat})`}
      </span>
      {deltaPct !== null && Math.abs(deltaPct) >= 0.5 && (
        <span
          className={`flex items-center gap-0.5 font-medium ${
            deltaPct < 0 ? 'text-[var(--primary)]' : 'text-[var(--error)]'
          }`}
        >
          {deltaPct < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
        </span>
      )}
    </p>
  );
}

export function CatalogImportReview({
  catalogImportId,
  onDone,
}: {
  catalogImportId: string;
  onDone: () => void;
}) {
  const { data: catalogImport, isLoading, error } = useCatalogImport(catalogImportId);
  const updateLineMut = useUpdateCatalogImportLine();
  const applyMut = useApplyCatalogImport();
  const discardMut = useDiscardCatalogImport();
  const deleteMut = useDeleteCatalogImport();
  const confirm = useConfirm();
  const addNotification = useNotification();
  const [onlyMatched, setOnlyMatched] = useState(false);

  const allLines = useMemo(() => catalogImport?.lines ?? [], [catalogImport]);
  const matchedCount = useMemo(
    () => allLines.filter((l) => l.matchedProduct).length,
    [allLines],
  );
  // Emparejadas primero: con cientos de líneas y pocos matches, sin esto son
  // una aguja en un pajar (hay que bajar cientos de "Sin artículo" a mano).
  const visibleLines = useMemo(() => {
    const source = onlyMatched ? allLines.filter((l) => l.matchedProduct) : allLines;
    return [...source].sort((a, b) => Number(!!b.matchedProduct) - Number(!!a.matchedProduct));
  }, [allLines, onlyMatched]);

  const notifyError = (e: unknown, fallback: string) =>
    addNotification({ type: 'error', title: 'Error', message: e instanceof Error ? e.message : fallback });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando catálogo...
      </div>
    );
  }
  if (error || !catalogImport) {
    return (
      <div className="rounded-2xl bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
        No se pudo cargar la importación: {error?.message}
      </div>
    );
  }

  const editable = catalogImport.status === 'PENDIENTE';
  const acceptedWithoutProduct = catalogImport.lines.filter(
    (l) => l.lineStatus === 'ACEPTADA' && !l.matchedProductId,
  ).length;
  const acceptedCount = catalogImport.lines.filter((l) => l.lineStatus === 'ACEPTADA').length;

  const setLineStatus = async (
    line: CatalogImportLine,
    lineStatus: CatalogLineStatus,
    matchedProductId?: string,
  ) => {
    try {
      await updateLineMut.mutateAsync({
        catalogImportId,
        lineId: line.id,
        lineStatus,
        matchedProductId,
      });
    } catch (e) {
      notifyError(e, 'No se pudo actualizar la línea');
    }
  };

  const handleApply = async () => {
    if (acceptedCount === 0) {
      addNotification({
        type: 'error',
        title: 'Nada que aplicar',
        message: 'Marca al menos una línea como Aceptada.',
      });
      return;
    }
    const ok = await confirm({
      title: 'Aplicar catálogo',
      description: `Se crearán/actualizarán ${acceptedCount} oferta(s) de proveedor y se evaluarán desviaciones de precio pactado. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await applyMut.mutateAsync(catalogImportId);
      addNotification({ type: 'success', title: 'Catálogo aplicado', message: `${acceptedCount} oferta(s) actualizada(s)` });
      onDone();
    } catch (e) {
      notifyError(e, 'No se pudo aplicar el catálogo');
    }
  };

  const handleDiscard = async () => {
    const ok = await confirm({
      title: 'Descartar importación',
      description: 'No se aplicará ningún cambio en las ofertas de proveedor.',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await discardMut.mutateAsync(catalogImportId);
      onDone();
    } catch (e) {
      notifyError(e, 'No se pudo descartar la importación');
    }
  };

  const handleDeleteFailed = async () => {
    const ok = await confirm({
      title: 'Borrar importación',
      description: 'Se borrará este intento fallido. Podrás volver a subir el catálogo.',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(catalogImportId);
      onDone();
    } catch (e) {
      notifyError(e, 'No se pudo borrar la importación');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onDone}
            aria-label="Volver al listado"
            className="rounded-lg p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm font-semibold text-[var(--on-surface)]">
              {catalogImport.supplier.name}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {catalogImport.lines.length} línea(s) · estado {catalogImport.status}
            </p>
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              disabled={discardMut.isPending}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              onClick={handleApply}
              disabled={applyMut.isPending || acceptedCount === 0 || acceptedWithoutProduct > 0}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {applyMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar ({acceptedCount})
            </button>
          </div>
        )}
      </div>

      {catalogImport.status === 'PROCESANDO' && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          <p className="text-sm font-medium text-[var(--on-surface)]">
            La IA está extrayendo los artículos...
          </p>
          <p className="max-w-sm text-xs text-[var(--on-surface-variant)]">
            En catálogos de muchas páginas puede tardar varios minutos. Puedes salir de aquí,
            esta pantalla se actualiza sola cuando termine.
          </p>
        </div>
      )}

      {catalogImport.status === 'ERROR' && (
        <div className="space-y-3 rounded-2xl border border-[var(--error)] bg-[var(--error-container)] p-4">
          <p className="text-sm font-medium text-[var(--on-error-container)]">
            La extracción falló: {catalogImport.errorMessage || 'error desconocido'}
          </p>
          <button
            onClick={handleDeleteFailed}
            disabled={deleteMut.isPending}
            className="rounded-xl border border-[var(--on-error-container)] px-4 py-2 text-sm font-medium text-[var(--on-error-container)] transition hover:bg-[var(--error)]/10 disabled:opacity-50"
          >
            Borrar y reintentar
          </button>
        </div>
      )}

      {(catalogImport.status === 'PENDIENTE' ||
        catalogImport.status === 'APLICADO' ||
        catalogImport.status === 'DESCARTADO') && (
      <>
      {matchedCount > 0 && (
        <label className="flex w-fit items-center gap-2 text-xs text-[var(--on-surface-variant)]">
          <input
            type="checkbox"
            checked={onlyMatched}
            onChange={(e) => setOnlyMatched(e.target.checked)}
          />
          Mostrar solo con coincidencia en tu BD ({matchedCount})
        </label>
      )}
      <ul className="space-y-2">
        {visibleLines.map((line) => {
          const badge = MATCH_BADGE[line.matchStatus];
          const BadgeIcon = badge.icon;
          const needsProduct = !line.matchedProductId;

          return (
            <li
              key={line.id}
              className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--on-surface)]">{line.rawName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--on-surface-variant)]">
                    {line.articleNumber && <span>Ref. {line.articleNumber}</span>}
                    {line.purchaseFormat && <span>{line.purchaseFormat}</span>}
                    <span className="font-medium text-[var(--on-surface)]">{formatEuro(line.unitPrice)}</span>
                    <span className={`flex items-center gap-1 ${badge.className}`}>
                      <BadgeIcon className="h-3.5 w-3.5" />
                      {badge.label}
                    </span>
                  </div>
                  {line.matchedProduct && (
                    <>
                      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                        → {line.matchedProduct.name}
                      </p>
                      <PriceComparison line={line} />
                    </>
                  )}
                  {editable && needsProduct && (
                    <div className="mt-2 max-w-sm">
                      <ProductSearchInput
                        supplierId={catalogImport.supplier.id}
                        placeholder="Asignar artículo existente..."
                        onSelect={(product) =>
                          setLineStatus(line, line.lineStatus, product.id)
                        }
                      />
                    </div>
                  )}
                </div>

                {editable && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setLineStatus(line, 'ACEPTADA')}
                      disabled={updateLineMut.isPending || needsProduct}
                      aria-label="Aceptar línea"
                      className={`rounded-lg p-2 transition disabled:opacity-30 ${
                        line.lineStatus === 'ACEPTADA'
                          ? 'bg-[var(--primary)] text-primary-foreground'
                          : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setLineStatus(line, 'RECHAZADA')}
                      aria-label="Rechazar línea"
                      className={`rounded-lg p-2 transition ${
                        line.lineStatus === 'RECHAZADA'
                          ? 'bg-[var(--error)] text-[var(--on-error)]'
                          : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      </>
      )}
    </div>
  );
}
