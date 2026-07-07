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
  portionWeight: string;
}

interface TabMermasProps {
  formData: MermasFormData;
  setFormData: (data: MermasFormData) => void;
}

/**
 * Prueba de rendimiento: Peso Bruto/Peso Neto de una muestra real del artículo,
 * de donde se deriva el Rendimiento/Merma real (sustituye al antiguo % Merma
 * manual). Peso Ración calcula además el coste de una ración servida.
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
  const portionWeight = parseFloat(formData.portionWeight) || 0;

  const hasYieldData = grossWeight > 0 && netWeight > 0;
  const yieldPercentage = hasYieldData ? (netWeight / grossWeight) * 100 : null;
  const wastePercentage = yieldPercentage !== null ? 100 - yieldPercentage : null;
  const totalCost = hasYieldData ? pricePerUnit * grossWeight : null;
  const realPrice = hasYieldData && netWeight > 0 ? totalCost! / netWeight : null;
  const portionCost = realPrice !== null && portionWeight > 0 ? realPrice * (portionWeight / 1000) : null;

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Peso Ración (g)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={formData.portionWeight}
            onChange={(e) => update('portionWeight', e.target.value)}
            placeholder="Ej: 190"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {hasYieldData && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 space-y-1.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-indigo-700">Coste Total de compra:</span>
            <span className="text-indigo-900 font-semibold text-right">{formatEuro(totalCost!)}</span>
            <span className="text-indigo-700">Rendimiento:</span>
            <span className="text-indigo-900 font-semibold text-right">{yieldPercentage!.toFixed(2)} %</span>
            <span className="text-indigo-700">Merma:</span>
            <span className="text-indigo-900 font-semibold text-right">{wastePercentage!.toFixed(2)} %</span>
            <span className="text-indigo-700">Precio Real/{unit}:</span>
            <span className="text-indigo-900 font-semibold text-right">{formatEuro(realPrice!)}/{unit}</span>
            {portionCost !== null && (
              <>
                <span className="text-indigo-700">Coste de la ración:</span>
                <span className="text-indigo-900 font-semibold text-right">{formatEuro(portionCost)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
