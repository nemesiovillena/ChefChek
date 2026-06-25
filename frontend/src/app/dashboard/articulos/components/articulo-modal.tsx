'use client';

import { useState, useMemo } from 'react';
import { useNotification } from '@/components/notification-system';
import { useCreateProduct, useUpdateProduct, useUploadProductImage, Product } from '@/hooks/use-products';
import { CategoryTreeNode } from '@/hooks/use-categories';
import PesoPrecioFields from './peso-precio-fields';
import TabAlergenos from './tab-alergenos';
import TabProveedorStock from './tab-proveedor-stock';
import TabNutricion from './tab-nutricion';

const TABS = [
  { id: 'formato-precio', label: 'Formato y Precio' },
  { id: 'alergenos', label: 'Alérgenos' },
  { id: 'proveedor-stock', label: 'Proveedor y Stock' },
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

const emptyFormData = {
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

const emptyNutrition = {
  energyKj: '', energyKcal: '', fat: '', saturatedFat: '', transFat: '',
  monounsaturatedFat: '', polyunsaturatedFat: '', omega3: '', cholesterol: '',
  carbohydrates: '', sugars: '', protein: '', salt: '',
};

export default function ArticuloModal({ isOpen, onClose, article, tree, suppliers = [] }: ArticuloModalProps) {
  const addNotification = useNotification();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const uploadImageMutation = useUploadProductImage();

  const [activeTab, setActiveTab] = useState('formato-precio');
  const [formData, setFormData] = useState(emptyFormData);
  const [allergens, setAllergens] = useState<number[]>([]);
  const [hideAllergens, setHideAllergens] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [nutritionalData, setNutritionalData] = useState(emptyNutrition);

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
        const ni = article.nutritionalInfo;
        setNutritionalData({
          energyKj: ni.energyKj?.toString() || '',
          energyKcal: ni.energyKcal?.toString() || '',
          fat: ni.fat?.toString() || '',
          saturatedFat: ni.saturatedFat?.toString() || '',
          transFat: ni.transFat?.toString() || '',
          monounsaturatedFat: ni.monounsaturatedFat?.toString() || '',
          polyunsaturatedFat: ni.polyunsaturatedFat?.toString() || '',
          omega3: ni.omega3?.toString() || '',
          cholesterol: ni.cholesterol?.toString() || '',
          carbohydrates: ni.carbohydrates?.toString() || '',
          sugars: ni.sugars?.toString() || '',
          protein: ni.protein?.toString() || '',
          salt: ni.salt?.toString() || '',
        });
      }
    } else {
      setFormData(emptyFormData);
      setAllergens([]);
      setHideAllergens(false);
      setImageUrl('');
      setNutritionalData(emptyNutrition);
    }
    setActiveTab('formato-precio');
  }, [article, tree]);

  const handleImageUpload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await uploadImageMutation.mutateAsync(form);
      setImageUrl(result.url);
    } catch (error: any) {
      addNotification({ type: 'error', title: 'Error', message: 'Error al subir imagen' });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      addNotification({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' });
      return;
    }

    const nutritionalInfo = Object.entries(nutritionalData).some(([, v]) => v)
      ? Object.fromEntries(Object.entries(nutritionalData).filter(([, v]) => v).map(([k, v]) => [k, parseFloat(v)]))
      : undefined;

    const parsedPrice = parseFloat(formData.purchasePrice);
    const productData: any = {
      name: formData.name,
      category: formData.categoryId || undefined,
      supplier: formData.supplierId || undefined,
      purchaseFormat: formData.purchaseFormat || undefined,
      referenceUnit: formData.referenceUnit || undefined,
      unitsPerFormat: parseInt(formData.unitsPerFormat) || undefined,
      referenceUnitSize: parseFloat(formData.referenceUnitSize) || undefined,
      purchasePrice: isNaN(parsedPrice) ? undefined : parsedPrice,
      wastePercentage: parseFloat(formData.wastePercentage) || undefined,
      iva: parseFloat(formData.iva) || undefined,
      qr: formData.qr || undefined,
      barcode: formData.barcode || undefined,
      brand: formData.brand || undefined,
      allergens,
      hideAllergens,
      imageUrl: imageUrl || undefined,
      nutritionalInfo,
      minimumStock: parseFloat(formData.minimumStock) || undefined,
      maximumStock: parseFloat(formData.maximumStock) || undefined,
    };

    try {
      if (article) {
        await updateMutation.mutateAsync({ id: article.id, ...productData });
        addNotification({ type: 'success', title: 'Artículo actualizado', message: 'Artículo actualizado correctamente' });
      } else {
        await createMutation.mutateAsync(productData);
        addNotification({ type: 'success', title: 'Artículo creado', message: 'Artículo creado correctamente' });
      }
      onClose();
    } catch (error: any) {
      addNotification({ type: 'error', title: 'Error', message: error.message || 'Error al guardar artículo' });
    }
  };

  if (!isOpen) return null;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-4xl shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {article ? 'Editar Artículo' : 'Crear Artículo'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Name field */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nombre del artículo"
            className="w-full px-4 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-lg"
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-zinc-800 mb-4">
          <nav className="flex -mb-px space-x-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[200px]">
          {activeTab === 'formato-precio' && (
            <PesoPrecioFields formData={formData} setFormData={setFormData} />
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
              suppliers={suppliers}
              tree={tree}
              formData={formData}
              setFormData={setFormData}
              currentStock={article?.stocks?.[0]?.quantity}
            />
          )}
          {activeTab === 'nutricion' && (
            <TabNutricion nutritionalData={nutritionalData} setNutritionalData={setNutritionalData} />
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
