'use client';

import { useState } from 'react';
import { AxiosError } from 'axios';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';

interface CreateSupplierInlineProps {
  onSuccess: (supplierId: string) => void;
  onCancel: () => void;
}

/**
 * Formulario inline mínimo para crear proveedor desde el SupplierPickerDialog.
 * Solo pide nombre (obligatorio) y CIF/NIF.
 */
export function CreateSupplierInline({ onSuccess, onCancel }: CreateSupplierInlineProps) {
  const [name, setName] = useState('');
  const [cifNif, setCifNif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{ success: boolean; data: { id: string } }>('/v1/products/suppliers', {
        name: name.trim(),
        cifNif: cifNif.trim() || undefined,
      });

      onSuccess(response.data.data.id);
    } catch (err: unknown) {
      let message = 'Error al crear proveedor';
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
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-gray-50 rounded-lg border border-dashed border-indigo-300">
      <p className="text-xs font-medium text-indigo-600">Nuevo proveedor</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="supplier-name" className="text-xs">Nombre *</Label>
          <Input
            id="supplier-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Nombre del proveedor"
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="supplier-cif" className="text-xs">CIF / NIF</Label>
          <Input
            id="supplier-cif"
            value={cifNif}
            onChange={(e) => setCifNif(e.target.value)}
            placeholder="B12345678"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !name.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          <span className="ml-1">Crear proveedor</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
