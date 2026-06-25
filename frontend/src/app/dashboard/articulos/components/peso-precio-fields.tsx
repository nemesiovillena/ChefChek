'use client';

import { UnitSelector } from '@/components/shared/unit-selector';

interface PesoPrecioFieldsProps {
  formData: {
    purchaseFormat: string;
    referenceUnit: string;
    unitsPerFormat: string;
    referenceUnitSize: string;
    wastePercentage: string;
    purchasePrice: string;
    iva: string;
    qr: string;
    brand: string;
    barcode: string;
  };
  setFormData: (data: any) => void;
}

// Dynamic labels based on reference unit
const UNIT_LABELS: Record<string, { size: string; sizePlaceholder: string; total: string }> = {
  kg: { size: 'Kilos por unidad', sizePlaceholder: 'Ej: 25', total: 'kg' },
  L:  { size: 'Litros por unidad', sizePlaceholder: 'Ej: 1.5', total: 'L' },
  und: { size: '', sizePlaceholder: '', total: 'und' },
};

export default function PesoPrecioFields({ formData, setFormData }: PesoPrecioFieldsProps) {
  const update = (field: string, value: string) => {
    const updates: Record<string, string> = { [field]: value };

    // When referenceUnit changes to "und", hide referenceUnitSize and force to 1
    if (field === 'referenceUnit' && value === 'und') {
      updates.referenceUnitSize = '1';
    }
    setFormData({ ...formData, ...updates });
  };

  // Live reference price preview
  const price = parseFloat(formData.purchasePrice) || 0;
  const unitsPerFormat = parseInt(formData.unitsPerFormat) || 1;
  const referenceUnitSize = parseFloat(formData.referenceUnitSize) || 1;
  const calculatedUnitSize = unitsPerFormat * referenceUnitSize;
  const refPrice = calculatedUnitSize > 0 ? price / calculatedUnitSize : 0;

  const unitLabels = UNIT_LABELS[formData.referenceUnit] || {
    size: 'Cantidad por unidad',
    sizePlaceholder: 'Ej: 1',
    total: formData.referenceUnit || 'unidad',
  };
  const isUnd = formData.referenceUnit === 'und';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formato de compra</label>
          <input
            type="text"
            value={formData.purchaseFormat}
            onChange={(e) => update('purchaseFormat', e.target.value)}
            placeholder="Ej: Caja 6 botellas, Saco 25kg"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de referencia</label>
          <UnitSelector
            value={formData.referenceUnit}
            onChange={(symbol) => update('referenceUnit', symbol)}
            className="w-full"
            placeholder="Seleccionar unidad"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidades por formato</label>
          <input
            type="number"
            step="1"
            min="1"
            value={formData.unitsPerFormat}
            onChange={(e) => update('unitsPerFormat', e.target.value)}
            placeholder="Ej: 6 (botellas por caja)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* referenceUnitSize field — hidden when referenceUnit is "und" */}
        {!isUnd && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{unitLabels.size}</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={formData.referenceUnitSize}
              onChange={(e) => update('referenceUnitSize', e.target.value)}
              placeholder={unitLabels.sizePlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% Merma</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.wastePercentage}
            onChange={(e) => update('wastePercentage', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio Compra (&euro;)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.purchasePrice}
            onChange={(e) => update('purchasePrice', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% IVA</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.iva}
            onChange={(e) => update('iva', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Reference price preview */}
      {price > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-indigo-700">
            Precio de referencia: <strong>€{refPrice.toFixed(2)}/{formData.referenceUnit || 'kg'}</strong>
          </span>
          {unitsPerFormat > 1 && (
            <span className="text-xs text-indigo-500">
              Total: {calculatedUnitSize} {unitLabels.total} por formato
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código QR</label>
          <input
            type="text"
            value={formData.qr}
            onChange={(e) => update('qr', e.target.value)}
            placeholder="Código QR"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marca <span className="text-gray-400">(opcional)</span></label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => update('brand', e.target.value)}
            placeholder="Marca del artículo"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras (EAN)</label>
        <input
          type="text"
          value={formData.barcode}
          onChange={(e) => update('barcode', e.target.value)}
          placeholder="Ej: 8412345678901"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
