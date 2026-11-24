'use client';

/** Form fields managed by TabCodigos. */
export interface CodigosFormData {
  qr: string;
  barcode: string;
  lot: string;
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
        <label className="block text-sm font-medium text-text-default mb-1">Código QR</label>
        <input
          type="text"
          value={formData.qr}
          onChange={(e) => update('qr', e.target.value)}
          placeholder="Código QR"
          className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-ring focus:border-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-default mb-1">Código de barras (EAN)</label>
        <input
          type="text"
          value={formData.barcode}
          onChange={(e) => update('barcode', e.target.value)}
          placeholder="Ej: 8412345678901"
          className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-ring focus:border-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-default mb-1">Lote</label>
        <input
          type="text"
          value={formData.lot}
          onChange={(e) => update('lot', e.target.value)}
          placeholder="Último lote recibido"
          className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-ring focus:border-ring"
        />
        <p className="text-xs text-text-muted mt-1">
          Se actualiza automáticamente al confirmar un albarán con lote. Editable manualmente.
        </p>
      </div>
    </div>
  );
}
