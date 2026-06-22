import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  averageDeliveryTime: number;
  reliabilityScore: number;
  priceTier: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredStatus: 'PREFERRED' | 'ALTERNATIVE' | 'EXCLUDED';
  orderMethods: string[];
  isActive: boolean;
}

interface CreateSupplierDto {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  averageDeliveryTime: number;
  reliabilityScore: number;
  priceTier: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredStatus: 'PREFERRED' | 'ALTERNATIVE' | 'EXCLUDED';
  orderMethods: string[];
  isActive: boolean;
}

interface UpdateSupplierDto {
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  averageDeliveryTime?: number;
  reliabilityScore?: number;
  priceTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredStatus?: 'PREFERRED' | 'ALTERNATIVE' | 'EXCLUDED';
  orderMethods?: string[];
  isActive?: boolean;
}

interface Props {
  supplier?: Supplier | null;
  onSubmit: (data: CreateSupplierDto | UpdateSupplierDto) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function SupplierForm({ supplier, onSubmit, onCancel, isSubmitting }: Props) {
  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    defaultValues: supplier || {
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      whatsapp: '',
      website: '',
      averageDeliveryTime: 3,
      reliabilityScore: 85,
      priceTier: 'MEDIUM',
      preferredStatus: 'ALTERNATIVE',
      orderMethods: ['EMAIL'],
      isActive: true
    }
  });

  const [selectedMethods, setSelectedMethods] = useState<string[]>(supplier?.orderMethods || ['EMAIL']);

  const toggleMethod = (method: string) => {
    const newMethods = selectedMethods.includes(method)
      ? selectedMethods.filter(m => m !== method)
      : [...selectedMethods, method];
    setSelectedMethods(newMethods);
    setValue('orderMethods', newMethods);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input {...register('name', { required: 'Nombre requerido' })} placeholder="Proveedor S.L." />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Persona de contacto</label>
          <Input {...register('contactPerson')} placeholder="Juan Pérez" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input {...register('email')} type="email" placeholder="contacto@proveedor.com" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <Input {...register('phone')} placeholder="+34 600 123 456" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">WhatsApp</label>
          <Input {...register('whatsapp')} placeholder="+34 600 123 456" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Website</label>
        <Input {...register('website')} placeholder="https://..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Entrega media (días)</label>
          <Input {...register('averageDeliveryTime', { valueAsNumber: true })} type="number" min="1" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fiabilidad (0-100)</label>
          <Input {...register('reliabilityScore', { valueAsNumber: true })} type="number" min="0" max="100" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nivel precios</label>
          <select
            {...register('priceTier')}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="LOW">Bajo</option>
            <option value="MEDIUM">Medio</option>
            <option value="HIGH">Alto</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Estado preferido</label>
          <select
            {...register('preferredStatus')}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="PREFERRED">Preferido</option>
            <option value="ALTERNATIVE">Alternativo</option>
            <option value="EXCLUDED">Excluido</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Métodos de pedido</label>
        <div className="flex gap-3 flex-wrap">
          {(['EMAIL', 'PHONE', 'WHATSAPP', 'WEB'] as const).map(method => (
            <label key={method} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMethods.includes(method)}
                onChange={() => toggleMethod(method)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">
                {method === 'EMAIL' && 'Email'}
                {method === 'PHONE' && 'Teléfono'}
                {method === 'WHATSAPP' && 'WhatsApp'}
                {method === 'WEB' && 'Web'}
              </span>
            </label>
          ))}
        </div>
        <input type="hidden" {...register('orderMethods')} />
      </div>

      <div className="flex items-center gap-2 pt-4 border-t">
        <input
          type="checkbox"
          {...register('isActive')}
          id="isActive"
          className="w-4 h-4 rounded border-gray-300"
        />
        <label htmlFor="isActive" className="text-sm cursor-pointer">Proveedor activo</label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : supplier ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}