'use client';

import { formatEuro } from '@/lib/utils';

/** Form fields managed by TabMermas (lee precio/formato de otras pestañas para el preview). */
export interface MermasFormData {
  purchasePrice: string;
  unitsPerFormat: string;
  referenceUnitSize: string;
  referenceUnit: string;
  grossWeight: string;
  netWeight: string;
  wastePercentage: string;
}

interface TabMermasProps {
  formData: MermasFormData;
  setFormData: (data: MermasFormData) => void;
}

/**
 * Prueba de rendimiento: Peso Bruto/Peso Neto de una muestra real del artículo,
 * de donde se deriva el Rendimiento/Merma real. Si no se pesa el artículo, la
 * Merma también se puede introducir a mano (ej. desde una tabla de referencia
 * de mermas conocidas: cebolla 15%, calabacín 11%...) — en ese caso el campo
 * Merma queda editable; en cuanto Peso Bruto y Peso Neto están rellenos, pasa
 * a mostrar (no-editable) la merma real calculada, que manda sobre la manual.
 */
export default function TabMermas({ formData, setFormData }: TabMermasProps) {
  const update = (field: keyof MermasFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const purchasePrice = parseFloat(formData.purchasePrice) || 0;
  const unitsPerFormat = parseInt(formData.unitsPerFormat) || 1;
  const referenceUnitSize = parseFloat(formData.referenceUnitSize) || 1;
  const unitSize = unitsPerFormat * referenceUnitSize || 1;
  const pricePerUnit = purchasePrice / unitSize;

  const grossWeight = parseFloat(formData.grossWeight) || 0;
  const netWeight = parseFloat(formData.netWeight) || 0;
  const manualWaste = parseFloat(formData.wastePercentage) || 0;

  const hasYieldData = grossWeight > 0 && netWeight > 0;
  const effectiveWaste = hasYieldData
    ? 100 - (netWeight / grossWeight) * 100
    : manualWaste > 0
      ? manualWaste
      : null;
  const hasAnyYieldInfo = effectiveWaste !== null;
  const yieldPercentage = hasAnyYieldInfo ? 100 - effectiveWaste! : null;
  const totalCost = hasYieldData ? pricePerUnit * grossWeight : null;
  const realPrice = hasAnyYieldInfo ? pricePerUnit / (yieldPercentage! / 100) : null;

  const unit = formData.referenceUnit || 'kg';

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-3 rounded-lg">
        <p className="text-sm font-medium text-gray-700">
          Prueba de rendimiento: pesa el artículo antes y después de limpiarlo/prepararlo para calcular el coste real del {unit} aprovechable.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Peso Bruto ({unit})</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={formData.grossWeight}
            onChange={(e) => update('grossWeight', e.target.value)}
            placeholder="Ej: 5.24"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Peso Neto ({unit})</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={formData.netWeight}
            onChange={(e) => update('netWeight', e.target.value)}
            placeholder="Ej: 3.99"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Merma (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={hasYieldData ? effectiveWaste!.toFixed(2) : formData.wastePercentage}
            onChange={(e) => update('wastePercentage', e.target.value)}
            disabled={hasYieldData}
            placeholder="Ej: 15 (si ya la conoces)"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              hasYieldData
                ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                : 'border-gray-300'
            }`}
          />
        </div>
      </div>

      {hasAnyYieldInfo && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 space-y-1.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-indigo-700">Precio Compra/{unit} (referencia):</span>
            <span className="text-indigo-900 font-semibold text-right">{formatEuro(pricePerUnit)}/{unit}</span>
            {hasYieldData && (
              <>
                <span className="text-indigo-700">Coste Total de compra:</span>
                <span className="text-indigo-900 font-semibold text-right">{formatEuro(totalCost!)}</span>
              </>
            )}
            <span className="text-indigo-700">Rendimiento:</span>
            <span className="text-indigo-900 font-semibold text-right">{yieldPercentage!.toFixed(2)} %</span>
            <span className="text-indigo-700">Merma:</span>
            <span className="text-indigo-900 font-semibold text-right">{effectiveWaste!.toFixed(2)} %</span>
            <span className="text-indigo-700">Precio Real/{unit}:</span>
            <span className="text-indigo-900 font-semibold text-right">{formatEuro(realPrice!)}/{unit}</span>
          </div>
        </div>
      )}
    </div>
  );
}
