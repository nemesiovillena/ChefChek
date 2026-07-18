'use client';

import { useMemo, useState } from 'react';
import { useNotification } from '@/components/notification-system';
import { useCreateProduct, useUpdateProduct, useUploadProductImage, useMergeProduct, Product, CreateProductData } from '@/hooks/use-products';
import { useProductNameCheck } from '@/hooks/use-product-name-check';
import { useConfirm } from '@/contexts/confirm.context';
import { CategoryTreeNode } from '@/hooks/use-categories';
import PesoPrecioFields from './peso-precio-fields';
import TabAlergenos from './tab-alergenos';
import TabProveedorStock from './tab-proveedor-stock';
import TabNutricion from './tab-nutricion';
import TabMermas from './tab-mermas';
import TabCodigos from './tab-codigos';
import { ProductPriceHistoryChart } from '@/components/products/product-price-history-chart';
import { ProductPriceHistoryTable } from '@/components/products/product-price-history-table';

const TABS: Array<{ id: string; label: string; editOnly?: boolean }> = [
  { id: 'formato-precio', label: 'Formato y Precio' },
  { id: 'codigos', label: 'Códigos' },
  { id: 'mermas', label: 'Mermas' },
  { id: 'alergenos', label: 'Alérgenos' },
  { id: 'proveedor-stock', label: 'Proveedor y Stock' },
  { id: 'nutricion', label: 'Nutrición' },
  { id: 'historial-precios', label: 'Hist. Precios', editOnly: true },
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
  grossWeight: '',
  netWeight: '',
  wastePercentage: '',
  purchasePrice: '',
  discountPercentage: '',
  iva: '10',
  qr: '',
  brand: '',
  barcode: '',
  lot: '',
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

/** Derive initial form values from the article prop (pure derivation, no setState). */
function deriveFormData(article: Product | null | undefined) {
  if (!article) return emptyFormData;
  return {
    name: article.name,
    purchaseFormat: article.purchaseFormat || '',
    referenceUnit: article.referenceUnit || 'kg',
    unitsPerFormat: String(article.unitsPerFormat || 1),
    referenceUnitSize: String(article.referenceUnitSize || article.unitSize || 1),
    grossWeight: article.grossWeight?.toString() || '',
    netWeight: article.netWeight?.toString() || '',
    wastePercentage: article.wastePercentage > 0 ? article.wastePercentage.toString() : '',
    purchasePrice: article.purchasePrice?.toString() || '',
    discountPercentage: article.discountPercentage > 0 ? article.discountPercentage.toString() : '',
    iva: article.iva?.toString() || '10',
    qr: article.qr || '',
    brand: article.brand || '',
    barcode: article.barcode || '',
    lot: article.lot || '',
    supplierId: article.supplierId || '',
    categoryId: article.categoryId || '',
    minimumStock: article.stocks?.[0]?.minimumStock?.toString() || '',
    maximumStock: article.stocks?.[0]?.maximumStock?.toString() || '',
  };
}

/** Derive initial nutrition values from the article prop (pure derivation, no setState). */
function deriveNutrition(article: Product | null | undefined): typeof emptyNutrition {
  const ni = article?.nutritionalInfo;
  if (!ni) return emptyNutrition;
  return {
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
  };
}

/** Outer component: keeps hooks stable and mounts the form keyed by the edited entity. */
export default function ArticuloModal({ isOpen, onClose, article, tree, suppliers = [] }: ArticuloModalProps) {
  if (!isOpen) return null;
  // Keyed remount resets all internal state when switching between create/edit targets.
  return (
    <ArticuloModalForm
      key={article?.id ?? 'new'}
      article={article}
      tree={tree}
      suppliers={suppliers}
      onClose={onClose}
    />
  );
}

interface ArticuloModalFormProps {
  article?: Product | null;
  tree: CategoryTreeNode[];
  suppliers: SupplierOption[];
  onClose: () => void;
}

function ArticuloModalForm({ article, tree, suppliers, onClose }: ArticuloModalFormProps) {
  const addNotification = useNotification();
  const confirm = useConfirm();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const uploadImageMutation = useUploadProductImage();
  const mergeMutation = useMergeProduct();

  // Lazy-initialize from the article prop; the keyed remount guarantees fresh state per entity.
  const [activeTab, setActiveTab] = useState('formato-precio');
  const [formData, setFormData] = useState(() => deriveFormData(article));
  // Aviso advisory de duplicados por nombre (no bloquea). Al editar excluye el propio id.
  const { matches: duplicateNameMatches } = useProductNameCheck(formData.name, article?.id);
  const [allergens, setAllergens] = useState<number[]>(() => article?.allergens ?? []);
  const [hideAllergens, setHideAllergens] = useState(() => article?.hideAllergens ?? false);
  const [imageUrl, setImageUrl] = useState(() => article?.imageUrl ?? '');
  const [nutritionalData, setNutritionalData] = useState(() => deriveNutrition(article));

  // Proveedores creados desde el diálogo rápido: se añaden localmente para que
  // el combobox pueda mostrarlos seleccionados sin esperar al refetch de la query.
  const [addedSuppliers, setAddedSuppliers] = useState<SupplierOption[]>([]);
  const suppliersList = useMemo(
    () => [...suppliers, ...addedSuppliers.filter((a) => !suppliers.some((s) => s.id === a.id))],
    [suppliers, addedSuppliers],
  );

  const handleImageUpload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await uploadImageMutation.mutateAsync(form);
      setImageUrl(result.url);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Error al subir imagen' });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      addNotification({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' });
      return;
    }
    if (!formData.categoryId) {
      addNotification({ type: 'error', title: 'Error', message: 'Debes seleccionar una categoría' });
      setActiveTab('formato-precio');
      return;
    }

    const nutritionalInfo = Object.entries(nutritionalData).some(([, v]) => v)
      ? Object.fromEntries(Object.entries(nutritionalData).filter(([, v]) => v).map(([k, v]) => [k, parseFloat(v)]))
      : undefined;

    const parsedPrice = parseFloat(formData.purchasePrice);
    const productData: CreateProductData = {
      name: formData.name,
      category: formData.categoryId || undefined,
      supplier: formData.supplierId || undefined,
      purchaseFormat: formData.purchaseFormat || undefined,
      referenceUnit: formData.referenceUnit || undefined,
      unitsPerFormat: parseInt(formData.unitsPerFormat) || undefined,
      referenceUnitSize: parseFloat(formData.referenceUnitSize) || undefined,
      purchasePrice: isNaN(parsedPrice) ? undefined : parsedPrice,
      discountPercentage: parseFloat(formData.discountPercentage) || 0,
      grossWeight: parseFloat(formData.grossWeight) || 0,
      netWeight: parseFloat(formData.netWeight) || 0,
      wastePercentage: parseFloat(formData.wastePercentage) || 0,
      iva: parseFloat(formData.iva) || undefined,
      qr: formData.qr || undefined,
      barcode: formData.barcode || undefined,
      lot: formData.lot || undefined,
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar artículo';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  const handleMerge = async (targetId: string, targetName: string) => {
    if (!article?.id) return;
    const ok = await confirm({
      title: 'Fusionar artículos',
      description: `Se moverán recetas, stock, histórico de precios y demás datos de «${article.name}» a «${targetName}». «${article.name}» quedará dado de baja (recuperable desde Papelera). Esta acción no se puede deshacer directamente.`,
      confirmText: 'Fusionar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const result = await mergeMutation.mutateAsync({ sourceId: article.id, targetId });
      addNotification({
        type: 'success',
        title: 'Artículos fusionados',
        message: `«${article.name}» se fusionó con «${targetName}»`,
      });
      if (result?.warnings?.length) {
        addNotification({
          type: 'warning',
          title: 'Revisa la fusión',
          message: result.warnings.join(' '),
        });
      }
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al fusionar artículos';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

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
          {duplicateNameMatches.length > 0 && (
            <div role="status" className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <span className="font-medium">Posible duplicado.</span> Ya existe un artículo con nombre similar:{' '}
                {duplicateNameMatches.slice(0, 3).map((m, idx) => (
                  <span key={m.id}>
                    <span className="font-semibold">«{m.name}»</span>
                    {!m.isActive && <span className="font-normal italic"> (inactivo)</span>}
                    {idx < Math.min(duplicateNameMatches.length, 3) - 1 ? ', ' : ''}
                  </span>
                ))}
                {duplicateNameMatches.length > 3 ? ` y ${duplicateNameMatches.length - 3} más.` : '.'}{' '}
                Puedes continuar si es un artículo distinto.
                {article?.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {duplicateNameMatches.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMerge(m.id, m.name)}
                        disabled={mergeMutation.isPending}
                        className="px-2 py-1 text-xs font-medium rounded border border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors"
                      >
                        Fusionar con «{m.name}»
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-zinc-800 mb-4">
          <div role="tablist" aria-label="Secciones del artículo" className="flex -mb-px space-x-4 overflow-x-auto">
            {TABS.filter((tab) => !tab.editOnly || !!article?.id).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
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
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[200px]">
          {activeTab === 'formato-precio' && (
            <PesoPrecioFields
              formData={formData}
              setFormData={(data) => setFormData({ ...formData, ...data })}
              tree={tree}
            />
          )}
          {activeTab === 'codigos' && (
            <TabCodigos
              formData={formData}
              setFormData={(data) => setFormData({ ...formData, ...data })}
            />
          )}
          {activeTab === 'mermas' && (
            <TabMermas
              formData={formData}
              setFormData={(data) => setFormData({ ...formData, ...data })}
            />
          )}
          {activeTab === 'alergenos' && (
            <TabAlergenos
              allergens={allergens}
              setAllergens={setAllergens}
              hideAllergens={hideAllergens}
              setHideAllergens={setHideAllergens}
              imageUrl={imageUrl}
              onImageUpload={handleImageUpload}
            />
          )}
          {activeTab === 'proveedor-stock' && (
            <TabProveedorStock
              productId={article?.id}
              suppliers={suppliersList}
              formData={formData}
              setFormData={(data) => setFormData({ ...formData, ...data })}
              currentStock={article?.stocks?.[0]?.quantity}
              basePurchasePrice={formData.purchasePrice}
              onSupplierCreated={(supplier) => {
                setAddedSuppliers((prev) => [...prev, supplier]);
              }}
            />
          )}
          {activeTab === 'nutricion' && (
            <TabNutricion nutritionalData={nutritionalData} setNutritionalData={setNutritionalData} />
          )}
          {activeTab === 'historial-precios' && article?.id && (
            <div className="space-y-4">
              <ProductPriceHistoryChart productId={article.id} supplierId={article.supplierId ?? undefined} />
              <ProductPriceHistoryTable productId={article.id} supplierId={article.supplierId ?? undefined} />
            </div>
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
