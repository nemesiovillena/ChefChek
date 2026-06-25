'use client';

import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Building2, Contact, MapPin, BarChart3 } from 'lucide-react';

/** Fields sent to POST /v1/products/suppliers — mirrors CreateSupplierDto */
interface SupplierForm {
  name: string;
  cifNif: string;
  sanitaryRegistry: string;
  contactPerson: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address: string;
  averageDeliveryTime: string; // string in form, parsed to number on submit
  priceTier: string;
  preferredStatus: string;
  orderMethods: string[];
}

const initialForm: SupplierForm = {
  name: '',
  cifNif: '',
  sanitaryRegistry: '',
  contactPerson: '',
  email: '',
  phone: '',
  whatsapp: '',
  website: '',
  address: '',
  averageDeliveryTime: '',
  priceTier: 'MEDIUM',
  preferredStatus: 'ALTERNATIVE',
  orderMethods: ['EMAIL'],
};

const ORDER_METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  PHONE: 'Teléfono',
  WEB: 'Web',
  WHATSAPP: 'WhatsApp',
};

const PRICE_TIER_LABELS: Record<string, string> = {
  LOW: 'Económico',
  MEDIUM: 'Medio',
  HIGH: 'Premium',
};

const PREFERRED_STATUS_LABELS: Record<string, string> = {
  PREFERRED: 'Preferido',
  ALTERNATIVE: 'Alternativo',
  EXCLUDED: 'Excluido',
};

interface CreateSupplierSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the newly created supplier ID */
  onSuccess: (supplierId: string) => void;
}

/**
 * Full supplier creation form in a side Sheet.
 * Only name is required — all other fields are optional and can be filled later.
 * Form wraps entire content so submit button always works regardless of scroll position.
 */
export function CreateSupplierSheet({ open, onOpenChange, onSuccess }: CreateSupplierSheetProps) {
  const [form, setForm] = useState<SupplierForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof SupplierForm>(key: K, value: SupplierForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleOrderMethod = (method: string) => {
    setForm((prev) => ({
      ...prev,
      orderMethods: prev.orderMethods.includes(method)
        ? prev.orderMethods.filter((m) => m !== method)
        : [...prev.orderMethods, method],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        cifNif: form.cifNif.trim() || undefined,
        sanitaryRegistry: form.sanitaryRegistry.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
        averageDeliveryTime: form.averageDeliveryTime ? Number(form.averageDeliveryTime) : undefined,
        priceTier: form.priceTier,
        preferredStatus: form.preferredStatus,
        orderMethods: form.orderMethods,
      };

      const response = await apiClient.post<{ success: boolean; data: { id: string } }>(
        '/v1/products/suppliers',
        payload,
      );

      setForm(initialForm);
      onOpenChange(false);
      onSuccess(response.data.data.id);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Error al crear proveedor';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg p-0 flex flex-col"
      >
        {/* Fixed header */}
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Nuevo proveedor
          </SheetTitle>
          <SheetDescription>
            Introduce los datos del proveedor. Solo el nombre es obligatorio, el resto puedes completarlo después.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable form content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* ── Datos generales ── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                Datos generales
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="s-name">Nombre *</Label>
                  <Input
                    id="s-name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    placeholder="Nombre del proveedor"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="s-cif">CIF / NIF</Label>
                  <Input
                    id="s-cif"
                    value={form.cifNif}
                    onChange={(e) => setField('cifNif', e.target.value)}
                    placeholder="B12345678"
                  />
                </div>
                <div>
                  <Label htmlFor="s-sanitary">Registro sanitario (RGSA)</Label>
                  <Input
                    id="s-sanitary"
                    value={form.sanitaryRegistry}
                    onChange={(e) => setField('sanitaryRegistry', e.target.value)}
                    placeholder="ES-XX-XXXXXX"
                  />
                </div>
              </div>
            </section>

            {/* ── Contacto ── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Contact className="h-4 w-4 text-indigo-500" />
                Contacto
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="s-contact">Persona de contacto</Label>
                  <Input
                    id="s-contact"
                    value={form.contactPerson}
                    onChange={(e) => setField('contactPerson', e.target.value)}
                    placeholder="Juan García"
                  />
                </div>
                <div>
                  <Label htmlFor="s-email">Email</Label>
                  <Input
                    id="s-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="correo@proveedor.es"
                  />
                </div>
                <div>
                  <Label htmlFor="s-phone">Teléfono</Label>
                  <Input
                    id="s-phone"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    placeholder="912345678"
                  />
                </div>
                <div>
                  <Label htmlFor="s-whatsapp">WhatsApp</Label>
                  <Input
                    id="s-whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setField('whatsapp', e.target.value)}
                    placeholder="+34612345678"
                  />
                </div>
                <div>
                  <Label htmlFor="s-website">Web</Label>
                  <Input
                    id="s-website"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                    placeholder="www.proveedor.es"
                  />
                </div>
              </div>
            </section>

            {/* ── Dirección ── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-500" />
                Dirección
              </h3>
              <div>
                <Label htmlFor="s-address">Dirección</Label>
                <Textarea
                  id="s-address"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="C/ Mayor 1, 28001 Madrid"
                  rows={2}
                  className="min-h-0"
                />
              </div>
            </section>

            {/* ── Comercial ── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Datos comerciales
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="s-delivery">Tiempo entrega (días)</Label>
                  <Input
                    id="s-delivery"
                    type="number"
                    min={1}
                    max={30}
                    value={form.averageDeliveryTime}
                    onChange={(e) => setField('averageDeliveryTime', e.target.value)}
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label>Nivel de precios</Label>
                  <Select
                    value={form.priceTier}
                    onValueChange={(v) => v && setField('priceTier', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRICE_TIER_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={form.preferredStatus}
                    onValueChange={(v) => v && setField('preferredStatus', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PREFERRED_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Order methods — toggle pills */}
              <div>
                <Label>Métodos de pedido</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(ORDER_METHOD_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleOrderMethod(value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        form.orderMethods.includes(value)
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Error ── */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          {/* Sticky footer — always visible */}
          <div className="sticky bottom-0 border-t bg-popover px-4 py-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !form.name.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-1">Creando...</span>
                </>
              ) : (
                'Crear proveedor'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
