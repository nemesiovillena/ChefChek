'use client';

import { PurchaseFormatInput } from '@/hooks/use-products';

interface TabFormatoCompraProps {
  purchaseFormats: PurchaseFormatInput[];
  setPurchaseFormats: (formats: PurchaseFormatInput[]) => void;
}

export default function TabFormatoCompra({ purchaseFormats, setPurchaseFormats }: TabFormatoCompraProps) {
  const addFormat = () => {
    setPurchaseFormats([...purchaseFormats, { name: '', format: '', price: 0 }]);
  };

  const removeFormat = (index: number) => {
    setPurchaseFormats(purchaseFormats.filter((_, i) => i !== index));
  };

  const updateFormat = (index: number, field: keyof PurchaseFormatInput, value: string | number) => {
    const updated = [...purchaseFormats];
    updated[index] = { ...updated[index], [field]: value };
    setPurchaseFormats(updated);
  };

  return (
    <div className="space-y-4">
      {purchaseFormats.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No hay formatos de compra añadidos</p>
      )}

      {purchaseFormats.map((pf, index) => (
        <div key={index} className="flex items-end gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del formato</label>
            <input type="text" value={pf.name} onChange={(e) => updateFormat(index, 'name', e.target.value)} placeholder="Ej: Caja 10kg" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
            <input type="text" value={pf.format} onChange={(e) => updateFormat(index, 'format', e.target.value)} placeholder="Ej: 10kg" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (&euro;)</label>
            <input type="number" step="0.01" min="0" value={pf.price || ''} onChange={(e) => updateFormat(index, 'price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <button type="button" onClick={() => removeFormat(index)} className="px-3 py-2 text-red-600 hover:text-red-800 font-medium">✕</button>
        </div>
      ))}

      <button type="button" onClick={addFormat} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
        + Añadir formato
      </button>
    </div>
  );
}
