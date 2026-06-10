'use client';

interface TabPesoPrecioProps {
  formData: {
    purchaseUnit: string;
    storageUnit: string;
    recipeUnit: string;
    wastePercentage: string;
    purchasePrice: string;
    iva: string;
    qr: string;
    brand: string;
    barcode: string;
  };
  setFormData: (data: any) => void;
}

const UNITS = ['kg', 'g', 'l', 'ml', 'unidades', 'docenas'];

export default function TabPesoPrecio({ formData, setFormData }: TabPesoPrecioProps) {
  const update = (field: string, value: string) => setFormData({ ...formData, [field]: value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Und. Compra (UC)</label>
          <select value={formData.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Seleccionar</option>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Und. Almacén (UA)</label>
          <select value={formData.storageUnit} onChange={(e) => update('storageUnit', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Seleccionar</option>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Und. Receta (UR)</label>
          <select value={formData.recipeUnit} onChange={(e) => update('recipeUnit', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Seleccionar</option>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% Merma</label>
          <input type="number" step="0.01" min="0" max="100" value={formData.wastePercentage} onChange={(e) => update('wastePercentage', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio Compra (&euro;)</label>
          <input type="number" step="0.01" min="0" value={formData.purchasePrice} onChange={(e) => update('purchasePrice', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% IVA</label>
          <input type="number" step="0.01" min="0" max="100" value={formData.iva} onChange={(e) => update('iva', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código QR</label>
          <input type="text" value={formData.qr} onChange={(e) => update('qr', e.target.value)} placeholder="Código QR" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marca <span className="text-gray-400">(opcional)</span></label>
          <input type="text" value={formData.brand} onChange={(e) => update('brand', e.target.value)} placeholder="Marca del artículo" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras (EAN)</label>
        <input type="text" value={formData.barcode} onChange={(e) => update('barcode', e.target.value)} placeholder="Ej: 8412345678901" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
    </div>
  );
}
