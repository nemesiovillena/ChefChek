'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useProducts, Product, useDeleteProduct, useUpdateProduct } from '@/hooks/use-products';
import { useCategoryTree, useCategories, CategoryTreeNode, Category } from '@/hooks/use-categories';
import { useApiQuery } from '@/hooks/use-api';
import { useQRCodes, QRCodeResponse } from '@/hooks/use-qr-codes';
import { Pencil, QrCode, Download, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import ArticuloModal from './components/articulo-modal';

interface Supplier {
  id: string;
  name: string;
}

export default function ArticulosPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();

  const { data: productsData, isLoading: productsLoading, error: productsError, refetch } = useProducts();
  const products: Product[] = Array.isArray(productsData?.data) ? productsData.data : Array.isArray(productsData) ? productsData : [];

  const { data: categoryTree } = useCategoryTree("articles");
  const { data: categoriesData } = useCategories("articles");
  const allCategories = useMemo(() => (Array.isArray(categoriesData) ? categoriesData : []), [categoriesData]);
  const tree: CategoryTreeNode[] = useMemo(() => (Array.isArray(categoryTree) ? categoryTree : []), [categoryTree]);

  const { data: suppliersResponse } = useApiQuery<Supplier[]>(['suppliers'], '/v1/products/suppliers');
  const suppliers: Supplier[] = Array.isArray(suppliersResponse) ? suppliersResponse : [];

  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const { generateQRCode, deleteQRCode, isLoading: qrLoading } = useQRCodes();
  const [productQRCodes, setProductQRCodes] = useState<Map<string, QRCodeResponse>>(new Map());

  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const availableSubcategories = useMemo(() => {
    if (!selectedParentCategory) return [];
    const parent = tree.find((c) => c.id === selectedParentCategory);
    return parent?.children || [];
  }, [selectedParentCategory, tree]);

  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    allCategories.forEach((c: Category) => { map[c.id] = c.name; });
    return map;
  }, [allCategories]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el artículo "${name}"?`)) {
      try {
        await deleteProductMutation.mutateAsync(id);
        addNotification({ type: 'success', title: 'Artículo eliminado', message: 'Artículo eliminado correctamente' });
        refetch();
      } catch (error: unknown) {
        addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al eliminar artículo' });
      }
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await updateProductMutation.mutateAsync({ id: product.id, isActive: !product.isActive });
      addNotification({
        type: 'success',
        title: 'Estado actualizado',
        message: `El artículo "${product.name}" ha sido ${!product.isActive ? 'activado' : 'desactivado'}`
      });
      refetch();
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al cambiar el estado del artículo' });
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
    refetch();
  };

  const handleGenerateQR = async (product: Product) => {
    try {
      const qrCode = await generateQRCode({
        entityType: 'product',
        entityId: product.id,
        data: { tenantId: product.tenantId || '' },
        config: { qrType: 'static', format: 'png', errorCorrection: 'M', size: 300 },
      });
      setProductQRCodes(prev => new Map(prev).set(product.id, qrCode));
      addNotification({ type: 'success', title: 'QR Generado', message: `Código QR generado para ${product.name}` });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al generar código QR' });
    }
  };

  const handleDownloadQR = async (productId: string) => {
    const qrCode = productQRCodes.get(productId);
    if (!qrCode?.qrCodeUrl) return;
    try {
      const response = await fetch(qrCode.qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-product-${productId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Error al descargar código QR' });
    }
  };

  const handleDeleteQR = async (productId: string, qrCodeId: string | undefined) => {
    if (!qrCodeId) return;
    try {
      await deleteQRCode(qrCodeId);
      setProductQRCodes(prev => {
        const newMap = new Map(prev);
        newMap.delete(productId);
        return newMap;
      });
      addNotification({ type: 'success', title: 'QR Eliminado', message: 'Código QR eliminado correctamente' });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al eliminar código QR' });
    }
  };

  const subcategoryIdsForParent = useMemo(() => {
    if (!selectedParentCategory) return null;
    const parent = tree.find((c) => c.id === selectedParentCategory);
    if (!parent) return null;
    const ids = new Set(parent.children?.map((c) => c.id) || []);
    ids.add(parent.id);
    return ids;
  }, [selectedParentCategory, tree]);

  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !subcategoryIdsForParent || subcategoryIdsForParent.has(product.categoryId || '');
    const matchesSubcategory = !selectedSubcategory || product.categoryId === selectedSubcategory;
    const matchesSupplier = !selectedSupplier || product.supplierId === selectedSupplier;
    return matchesSearch && matchesCategory && matchesSubcategory && matchesSupplier;
  });

  const supplierIds = [...new Set(products.map((p: Product) => p.supplierId).filter(Boolean))];

  const getCategoryDisplay = useCallback((catId: string | undefined): string => {
    if (!catId) return '-';
    if (categoryNameMap[catId]) return categoryNameMap[catId];
    return catId;
  }, [categoryNameMap]);

  const formatLastPurchaseDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    sorted.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          break;
        case 'category':
          const parentCatA = tree.find((p) => p.children?.some((c) => c.id === a.categoryId));
          const parentCatB = tree.find((p) => p.children?.some((c) => c.id === b.categoryId));
          valA = (parentCatA?.name || '').toLowerCase();
          valB = (parentCatB?.name || '').toLowerCase();
          break;
        case 'subcategory':
          valA = getCategoryDisplay(a.categoryId).toLowerCase();
          valB = getCategoryDisplay(b.categoryId).toLowerCase();
          break;
        case 'purchasePrice':
          valA = a.purchasePrice || 0;
          valB = b.purchasePrice || 0;
          break;
        case 'netPrice':
          valA = a.netPrice || 0;
          valB = b.netPrice || 0;
          break;
        case 'status':
          valA = a.isActive ? 1 : 0;
          valB = b.isActive ? 1 : 0;
          break;
        case 'lastPurchaseDate':
          valA = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0;
          valB = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredProducts, sortField, sortDirection, tree, getCategoryDisplay]);

  const renderSortableHeader = (label: string, field: string) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="group px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors duration-150"
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
            )
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  // Guard: not authenticated or loading
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600">Error al cargar artículos: {productsError.message}</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Artículos</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Gestión de artículos e inventario</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
              Crear Artículo
            </button>
          </div>
        </div>

        {/* Chained Filters */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nombre o referencia" className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
              <select value={selectedParentCategory} onChange={(e) => { setSelectedParentCategory(e.target.value); setSelectedSubcategory(''); }} className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">Todas</option>
                {tree.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategoría</label>
              <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} disabled={!selectedParentCategory} className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600">
                <option value="">Todas</option>
                {availableSubcategories.map((sub) => (<option key={sub.id} value={sub.id}>{sub.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
              <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">Todos</option>
                {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                {supplierIds.filter((id) => !suppliers.some((s) => s.id === id)).map((id) => (
                  <option key={id} value={id}>{categoryNameMap[id!] || id}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Articles Table */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead className="bg-gray-50 dark:bg-zinc-800/50">
                <tr>
                  {renderSortableHeader('Nombre', 'name')}
                  {renderSortableHeader('Categoría', 'category')}
                  {renderSortableHeader('Subcategoría', 'subcategory')}
                  {renderSortableHeader('Proveedor', 'supplier')}
                  {renderSortableHeader('Precio Compra', 'purchasePrice')}
                  {renderSortableHeader('Precio Neto', 'netPrice')}
                  {renderSortableHeader('Última Compra', 'lastPurchaseDate')}
                  {renderSortableHeader('Estado', 'status')}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {productsLoading ? (
                  <tr><td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Cargando...</td></tr>
                ) : sortedProducts.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay artículos</td></tr>
                ) : (
                  sortedProducts.map((product: Product) => {
                    const parentCat = tree.find((p) => p.children?.some((c) => c.id === product.categoryId));
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{parentCat?.name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getCategoryDisplay(product.categoryId)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{product.supplier?.name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">&euro;{product.purchasePrice.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">&euro;{product.netPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.lastPurchaseDate ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                              {formatLastPurchaseDate(product.lastPurchaseDate)}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(product)}
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150 ${
                              product.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {product.isActive ? 'Activo' : 'Desactivado'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            title="Editar artículo"
                            aria-label="Editar artículo"
                            className="inline-flex items-center justify-center p-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-[var(--secondary)]/30 dark:bg-[var(--secondary)]/10 dark:text-[var(--secondary)] dark:hover:bg-[var(--secondary)]/20 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {productQRCodes.has(product.id) ? (
                            <>
                              <button
                                onClick={() => handleDownloadQR(product.id)}
                                disabled={qrLoading}
                                title="Descargar código QR"
                                aria-label="Descargar código QR"
                                className="inline-flex items-center justify-center p-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-50"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteQR(product.id, productQRCodes.get(product.id)?.qrCodeId)}
                                disabled={qrLoading}
                                title="Eliminar código QR"
                                aria-label="Eliminar código QR"
                                className="inline-flex items-center justify-center p-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-[var(--error)]/30 dark:bg-[var(--error)]/10 dark:text-[var(--error)] dark:hover:bg-[var(--error)]/20 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleGenerateQR(product)}
                              disabled={qrLoading}
                              title="Generar código QR"
                              aria-label="Generar código QR"
                              className="inline-flex items-center justify-center p-2 border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-indigo-900/30 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-950/40 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-50"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            title="Eliminar artículo"
                            aria-label="Eliminar artículo"
                            className="inline-flex items-center justify-center p-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-[var(--error)]/30 dark:bg-[var(--error)]/10 dark:text-[var(--error)] dark:hover:bg-[var(--error)]/20 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ArticuloModal
        isOpen={showModal}
        onClose={handleCloseModal}
        article={selectedProduct}
        tree={tree}
        suppliers={suppliers}
      />
    </div>
  );
}
