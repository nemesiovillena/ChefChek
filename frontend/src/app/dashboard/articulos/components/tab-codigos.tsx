'use client';

/** Form fields managed by TabCodigos. */
export interface CodigosFormData {
  qr: string;
  barcode: string;
}

interface TabCodigosProps {
  formData: CodigosFormData;
  setFormData: (data: CodigosFormData) => void;
}

export default function TabCodigos({ formData, setFormData }: TabCodigosProps) {
  const update = (field: keyof CodigosFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-4">
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
