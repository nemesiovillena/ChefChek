'use client';

import { useState, useMemo } from 'react';
import { useNotification } from '@/components/notification-system';
import { useCreateProduct, useUpdateProduct, useUploadProductImage, Product } from '@/hooks/use-products';
import { CategoryTreeNode } from '@/hooks/use-categories';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
import PesoPrecioFields from './peso-precio-fields';
import TabAlergenos from './tab-alergenos';
import TabProveedorStock from './tab-proveedor-stock';
import TabNutricion from './tab-nutricion';

const TABS = [
  { id: 'formato-precio', label: 'Formato y Precio' },
  { id: 'alergenos', label: 'Alérgenos' },
  { id: 'proveedor-stock', label: 'Proveedor/Stock' },
  { id: 'nutricion', label: 'Nutrición' },
];

interface SupplierOption {
  id: string;
  name: string;
}

interface ArticuloModalProps {
  isOpen: boolean;
  onClose: () => void;
  article?: Product | null;
  tree: CategoryTreeNode[];
  suppliers?: SupplierOption[];
}

interface FormData {
  name: string;
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
  supplierId: string;
  categoryId: string;
  minimumStock: string;
  maximumStock: string;
}

interface NutritionalData {
  energyKj: string;
  energyKcal: string;
  fat: string;
  saturatedFat: string;
  transFat: string;
  monounsaturatedFat: string;
  polyunsaturatedFat: string;
  omega3: string;
  cholesterol: string;
  carbohydrates: string;
  sugars: string;
  protein: string;
  salt: string;
}

const emptyFormData: FormData = {
  name: '',
  purchaseFormat: '',
  referenceUnit: 'kg',
  unitsPerFormat: '1',
  referenceUnitSize: '1',
  wastePercentage: '',
  purchasePrice: '',
  iva: '10',
  qr: '',
  brand: '',
  barcode: '',
  supplierId: '',
  categoryId: '',
  minimumStock: '',
  maximumStock: '',
};

const emptyNutrition: NutritionalData = {
  energyKj: '', energyKcal: '', fat: '', saturatedFat: '', transFat: '',
  monounsaturatedFat: '', polyunsaturatedFat: '', omega3: '', cholesterol: '',
  carbohydrates: '', sugars: '', protein: '', salt: '',
};

/** Centered modal for creating/editing articles */
export default function ArticuloDrawer({ isOpen, onClose, article, tree, suppliers = [] }: ArticuloModalProps) {
  const addNotification = useNotification();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const uploadImageMutation = useUploadProductImage();

  const [activeTab, setActiveTab] = useState('formato-precio');
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [allergens, setAllergens] = useState<number[]>([]);
  const [hideAllergens, setHideAllergens] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [nutritionalData, setNutritionalData] = useState<NutritionalData>(emptyNutrition);
  const [saving, setSaving] = useState(false);
  const [suppliersList, setSuppliersList] = useState<SupplierOption[]>(suppliers);

  // Sync suppliers from props when drawer opens
  useMemo(() => {
    if (isOpen) setSuppliersList(suppliers);
  }, [isOpen, suppliers]);

  // Load article data when editing
  useMemo(() => {
    if (article) {
      setFormData({
        name: article.name,
        purchaseFormat: article.purchaseFormat || '',
        referenceUnit: article.referenceUnit || 'kg',
        unitsPerFormat: String(article.unitsPerFormat || 1),
        referenceUnitSize: String(article.referenceUnitSize || article.unitSize || 1),
        wastePercentage: article.wastePercentage?.toString() || '',
        purchasePrice: article.purchasePrice?.toString() || '',
        iva: article.iva?.toString() || '10',
        qr: article.qr || '',
        brand: article.brand || '',
        barcode: article.barcode || '',
        supplierId: article.supplierId || '',
        categoryId: article.categoryId || '',
        minimumStock: article.stocks?.[0]?.minimumStock?.toString() || '',
        maximumStock: article.stocks?.[0]?.maximumStock?.toString() || '',
      });
      setAllergens(article.allergens || []);
      setHideAllergens(article.hideAllergens || false);
      setImageUrl(article.imageUrl || '');
      if (article.nutritionalInfo) {
        setNutritionalData({
          energyKj: article.nutritionalInfo.energyKj?.toString() || '',
          energyKcal: article.nutritionalInfo.energyKcal?.toString() || '',
          fat: article.nutritionalInfo.fat?.toString() || '',
          saturatedFat: article.nutritionalInfo.saturatedFat?.toString() || '',
          transFat: article.nutritionalInfo.transFat?.toString() || '',
          monounsaturatedFat: article.nutritionalInfo.monounsaturatedFat?.toString() || '',
          polyunsaturatedFat: article.nutritionalInfo.polyunsaturatedFat?.toString() || '',
          omega3: article.nutritionalInfo.omega3?.toString() || '',
          cholesterol: article.nutritionalInfo.cholesterol?.toString() || '',
          carbohydrates: article.nutritionalInfo.carbohydrates?.toString() || '',
          sugars: article.nutritionalInfo.sugars?.toString() || '',
          protein: article.nutritionalInfo.protein?.toString() || '',
          salt: article.nutritionalInfo.salt?.toString() || '',
        });
      }
    } else {
      setFormData(emptyFormData);
      setAllergens([]);
      setHideAllergens(false);
      setImageUrl('');
      setNutritionalData(emptyNutrition);
      setActiveTab('formato-precio');
    }
  }, [article, tree]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addNotification({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' });
      return;
    }

    const categoryId = formData.categoryId;
    if (!categoryId) {
      addNotification({ type: 'error', title: 'Error', message: 'Debes seleccionar una categoría' });
      setActiveTab('proveedor-stock');
      return;
    }

    const price = parseFloat(formData.purchasePrice) || 0;
    if (price <= 0) {
      addNotification({ type: 'error', title: 'Error', message: 'El precio de compra debe ser mayor a 0' });
      return;
    }

    setSaving(true);
    try {
      const data: any = {
        name: formData.name,
        purchaseFormat: formData.purchaseFormat,
        referenceUnit: formData.referenceUnit,
        unitsPerFormat: parseInt(formData.unitsPerFormat) || 1,
        referenceUnitSize: parseFloat(formData.referenceUnitSize) || 1,
        wastePercentage: formData.wastePercentage ? parseFloat(formData.wastePercentage) : 0,
        purchasePrice: price,
        iva: formData.iva ? parseInt(formData.iva) : 10,
        qr: formData.qr,
        brand: formData.brand,
        barcode: formData.barcode,
        category: categoryId,
        supplier: formData.supplierId || undefined,
        allergens,
        hideAllergens,
        minimumStock: formData.minimumStock ? parseFloat(formData.minimumStock) : undefined,
        maximumStock: formData.maximumStock ? parseFloat(formData.maximumStock) : undefined,
        nutritionalInfo: Object.fromEntries(
          Object.entries(nutritionalData).filter(([, v]) => v !== '').map(([k, v]) => [k, parseFloat(v)])
        ),
      };

      if (article) {
        await updateMutation.mutateAsync({ id: article.id, ...data });
        addNotification({ type: 'success', title: 'Artículo actualizado', message: `"${formData.name}" guardado correctamente` });
      } else {
        await createMutation.mutateAsync(data);
        addNotification({ type: 'success', title: 'Artículo creado', message: `"${formData.name}" creado correctamente` });
      }
      onClose();
    } catch (error: any) {
      addNotification({ type: 'error', title: 'Error', message: error.message || 'Error al guardar artículo' });
    } finally {
      setSaving(false);
    }
  };

  // Image upload handler for allergens tab
  const handleImageUpload = async (file: File) => {
    try {
      const uploadForm = new window.FormData();
      uploadForm.append('file', file);
      if (article?.id) uploadForm.append('productId', article.id);
      const result = await uploadImageMutation.mutateAsync(uploadForm as any);
      if (result?.url) setImageUrl(result.url);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Error al subir imagen' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-lg bg-white mb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {article ? `Editar: ${article.name}` : 'Nuevo Artículo'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Name field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nombre del artículo"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-lg"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto flex-wrap gap-1 bg-gray-100 p-1 rounded-lg mb-4">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-xs px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-md"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Tab content */}
        <div className="min-h-[200px]">
          {activeTab === 'formato-precio' && (
            <PesoPrecioFields formData={formData} setFormData={(data: any) => setFormData(data)} />
          )}
          {activeTab === 'alergenos' && (
            <TabAlergenos
              allergens={allergens}
              setAllergens={setAllergens}
              hideAllergens={hideAllergens}
              setHideAllergens={setHideAllergens}
              imageUrl={imageUrl}
              setImageUrl={setImageUrl}
              onImageUpload={handleImageUpload}
            />
          )}
          {activeTab === 'proveedor-stock' && (
            <TabProveedorStock
              formData={formData}
              setFormData={setFormData}
              tree={tree}
              suppliers={suppliersList}
              onSupplierCreated={(supplier) => {
                setSuppliersList((prev) => [...prev, supplier]);
              }}
            />
          )}
          {activeTab === 'nutricion' && (
            <TabNutricion
              nutritionalData={nutritionalData}
              setNutritionalData={setNutritionalData}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : article ? 'Guardar cambios' : 'Crear artículo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
