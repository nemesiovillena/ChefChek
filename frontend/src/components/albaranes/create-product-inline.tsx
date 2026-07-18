'use client';

import { useState } from 'react';
import { AxiosError } from 'axios';
import apiClient from '@/lib/api-client';
import { matchLine } from '@/lib/api-albaran';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProductNameCheck } from '@/hooks/use-product-name-check';
import { useCategoryTree } from '@/hooks/use-categories';
// Reutiliza el mismo componente de "campos core" que usa el modal de Artículos
// → paridad de campos y precio de referencia sin mantener dos formularios (DRY).
import PesoPrecioFields, { PesoPrecioFormData } from '@/app/dashboard/articulos/components/peso-precio-fields';
import { Loader2, Plus } from 'lucide-react';
import type { AlbaranLine } from '@/lib/api-albaran';

interface CreateProductInlineProps {
  albaranId: string;
  line: AlbaranLine;
  /** Proveedor del albarán: el producto nace vinculado a él */
  supplierId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateProductInline({
  albaranId,
  line,
  supplierId,
  onSuccess,
  onCancel,
}: CreateProductInlineProps) {
  const [name, setName] = useState(line.description);
  // Mismo shape que PesoPrecioFields (formato, unidad, unidades/formato, tamaño
  // ref, precio, descuento, IVA, categoría, marca). Precios desde la línea OCR.
  const [formData, setFormData] = useState<PesoPrecioFormData>({
    purchaseFormat: '',
    referenceUnit: line.unit || 'kg',
    unitsPerFormat: '1',
    referenceUnitSize: '1',
    purchasePrice: line.unitPrice != null ? String(line.unitPrice) : '',
    discountPercentage: '',
    iva: '10',
    brand: '',
    categoryId: '',
  });
  const { data: tree = [] } = useCategoryTree();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aviso advisory de duplicados por nombre (mismo criterio que Artículos).
  // No bloquea: solo informa para evitar crear un artículo paralelo.
  const { matches: duplicateNameMatches } = useProductNameCheck(name);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Vincular directamente a un duplicado detectado, sin salir a "Elegir".
  const handleLinkExisting = async (productId: string) => {
    setLinkingId(productId);
    setLinkError(null);
    try {
      await matchLine(albaranId, line.id, productId);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al vincular producto';
      setLinkError(message);
      setLinkingId(null);
    }
  };

  // Subtotal de la línea = cantidad × precio. Sirve para verificar que el
  // precio introducido cuadra con el total que el OCR leyó en el albarán.
  const parsedPrice = parseFloat(formData.purchasePrice);
  const lineQuantity = Number(line.quantity) || 0;
  const lineSubtotal =
    !Number.isNaN(parsedPrice) && parsedPrice >= 0 ? lineQuantity * parsedPrice : null;
  const originalTotal = Number(line.lineAmount) || 0;
  const subtotalMatches =
    lineSubtotal !== null && originalTotal > 0
      ? Math.abs(lineSubtotal - originalTotal) < 0.01
      : null;
  const fmtEuro = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    // Paridad con el modal de Artículos: la categoría es obligatoria para no
    // crear artículos huérfanos sin clasificar.
    if (!formData.categoryId) {
      setError('Debes seleccionar una categoría');
      return;
    }
    if (!(parseFloat(formData.referenceUnitSize) > 0)) {
      setError('El contenido debe ser mayor que 0');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const price = !Number.isNaN(parsedPrice) ? parsedPrice : 0;
      const unitsPerFormat = parseInt(formData.unitsPerFormat) || 1;
      const referenceUnitSize = parseFloat(formData.referenceUnitSize) || 1;

      // Nota de paridad: el modal de Artículos NO envía netPrice (el backend lo
      // calcula con margen). Aquí se mantiene netPrice=precio para preservar el
      // comportamiento actual y no alterar el coste silenciosamente. Alinearlo
      // es una decisión de coste pendiente (ver memoria netprice-overloaded).
      const response = await apiClient.post<{ id: string }>('/v1/products', {
        name: name.trim(),
        netPrice: price,
        purchasePrice: !Number.isNaN(parsedPrice) ? parsedPrice : undefined,
        referenceUnit: formData.referenceUnit,
        unitsPerFormat,
        referenceUnitSize,
        purchaseFormat:
          formData.purchaseFormat ||
          (referenceUnitSize !== 1
            ? `${referenceUnitSize} ${formData.referenceUnit}`
            : formData.referenceUnit),
        discountPercentage: parseFloat(formData.discountPercentage) || 0,
        iva: parseFloat(formData.iva) || undefined,
        brand: formData.brand || undefined,
        category: formData.categoryId,
        // El backend interpreta `supplier` como el ID del proveedor
        ...(supplierId ? { supplier: supplierId } : {}),
      });

      const productId = response.data.id;

      // Match line to new product
      await matchLine(albaranId, line.id, productId);

      onSuccess();
    } catch (err: unknown) {
      let message = 'Error al crear producto';
      if (err instanceof AxiosError) {
        const dataMessage = err.response?.data as { message?: unknown } | undefined;
        if (typeof dataMessage?.message === 'string') {
          message = dataMessage.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-gray-50 rounded-lg">
      <div>
        <Label htmlFor="name" className="text-xs">Nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="h-8 text-sm"
        />
        {duplicateNameMatches.length > 0 && (
          <div role="status" className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>
              <span className="font-medium">Posible duplicado.</span> Ya existe:{' '}
              {duplicateNameMatches.slice(0, 3).map((m, idx) => (
                <span key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleLinkExisting(m.id)}
                    disabled={linkingId !== null}
                    className="font-semibold underline decoration-dotted underline-offset-2 hover:text-amber-950 disabled:opacity-50 dark:hover:text-amber-100"
                  >
                    «{m.name}»
                  </button>
                  {!m.isActive && <span className="italic"> (inactivo)</span>}
                  {linkingId === m.id && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                  {idx < Math.min(duplicateNameMatches.length, 3) - 1 ? ', ' : ''}
                </span>
              ))}
              {duplicateNameMatches.length > 3 ? ` y ${duplicateNameMatches.length - 3} más.` : '.'}
              {' '}
              <span className="italic">(clic en el nombre para vincular esta línea a ese artículo)</span>
            </span>
          </div>
        )}
        {linkError && <p className="mt-1 text-xs text-red-600">{linkError}</p>}
      </div>

      {/* Campos core idénticos a la pestaña "Formato y Precio" de Artículos */}
      <PesoPrecioFields formData={formData} setFormData={setFormData} tree={tree} />

      {lineSubtotal !== null && (
        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>
            Subtotal línea:{' '}
            <span className="font-medium text-gray-700">
              {lineQuantity.toLocaleString('es-ES')} {formData.referenceUnit} × {fmtEuro(parsedPrice)} € = {fmtEuro(lineSubtotal)} €
            </span>
          </span>
          {subtotalMatches !== null && (
            <span className={subtotalMatches ? 'text-green-600' : 'text-amber-600'}>
              {subtotalMatches
                ? '✓ coincide con el total del albarán'
                : `≠ total albarán (${fmtEuro(originalTotal)} €)`}
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          <span className="ml-1">Crear y asignar</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
