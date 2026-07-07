'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useProducts, Product, useDeleteProduct, useUpdateProduct, getReferencePrice, formatRefPrice, getRealPrice } from '@/hooks/use-products';
import { useCategoryTree, useCategories, CategoryTreeNode, Category } from '@/hooks/use-categories';
import { useApiQuery } from '@/hooks/use-api';
import { useQRCodes, QRCodeResponse } from '@/hooks/use-qr-codes';
import { useConfirm } from '@/contexts/confirm.context';
import { Pencil, QrCode, Download, Trash2, X, ChevronUp, ChevronDown, Tag } from 'lucide-react';
import ArticuloModal from './components/articulo-modal';
import ImportModal from './components/import-modal';

interface Supplier {
  id: string;
  name: string;
}

export default function ArticulosPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const confirm = useConfirm();

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
  const [showImportModal, setShowImportModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Date filters
  const [dateFilterType, setDateFilterType] = useState<'createdAt' | 'lastPurchaseDate'>('createdAt');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const getExportData = () => {
    return sortedProducts.map((product) => ({
      Nombre: product.name,
      Descripción: product.description || '',
      Categoría: getCategoryDisplay(product.categoryId),
      Proveedor: product.supplier?.name || '-',
      'Precio Compra': product.purchasePrice.toFixed(2),
      'Precio Real': getRealPrice(product)?.toFixed(2) ?? '-',
      'Precio Referencia': formatRefPrice(getReferencePrice(product), product.referenceUnit),
      IVA: product.iva,
      Formato: product.purchaseFormat || '',
      Unidad: product.referenceUnit,
      UnidadesPorFormato: product.unitsPerFormat,
      TamañoUnidad: product.referenceUnitSize,
      CódigoBarras: product.barcode || '',
      Marca: product.brand || '',
      Estado: product.isActive ? 'Activo' : 'Desactivado',
      ÚltimaCompra: product.lastPurchaseDate ? formatLastPurchaseDate(product.lastPurchaseDate) : '-'
    }));
  };

  const exportToCSV = () => {
    const data = getExportData();
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `articulos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const data = getExportData();
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(';');
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(';')
    );
    const blob = new Blob(['\uFEFF' + [headers, ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `articulos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo abrir la ventana de impresión' });
      return;
    }

    const rowsHtml = sortedProducts.map((product) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${product.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${getCategoryDisplay(product.categoryId)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${product.supplier?.name || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">&euro;${product.purchasePrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${getRealPrice(product) !== null ? '&euro;' + getRealPrice(product)!.toFixed(2) : '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatRefPrice(getReferencePrice(product), product.referenceUnit)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${product.isActive ? 'Activo' : 'Desactivado'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Listado de Artículos - ChefChek</title>
          <style>
            body { font-family: sans-serif; color: #333; margin: 20px; }
            h2 { color: #4F46E5; margin-bottom: 5px; }
            p { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th { background-color: #F3F4F6; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
            tr:nth-child(even) { background-color: #F9FAFB; }
          </style>
        </head>
        <body>
          <h2>ChefChek - Reporte de Artículos</h2>
          <p>Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th style="text-align: right;">P. Compra</th>
                <th style="text-align: right;">P. Real</th>
                <th style="text-align: right;">P. Ref.</th>
                <th style="text-align: center;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: 'Eliminar artículo',
      description: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
      children: <ArticleContextCard product={product} />,
    });
    if (!ok) return;
    try {
      await deleteProductMutation.mutateAsync(product.id);
      addNotification({
        type: 'success',
        title: 'Artículo eliminado',
        message: `"${product.name}" se ha eliminado correctamente.`,
      });
      refetch();
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo eliminar',
        message: error instanceof Error ? error.message : 'Error al eliminar el artículo',
      });
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

    let matchesDate = true;
    if (startDate || endDate) {
      const productDateStr = product[dateFilterType];
      if (!productDateStr) {
        matchesDate = false;
      } else {
        const productDate = new Date(productDateStr);
        productDate.setHours(0, 0, 0, 0);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (productDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (productDate > end) matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesCategory && matchesSubcategory && matchesSupplier && matchesDate;
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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
          valA = (a.categoryId ? categoryNameMap[a.categoryId] || a.categoryId : '').toLowerCase();
          valB = (b.categoryId ? categoryNameMap[b.categoryId] || b.categoryId : '').toLowerCase();
          break;
        case 'purchasePrice':
          valA = a.purchasePrice || 0;
          valB = b.purchasePrice || 0;
          break;
        case 'realPrice':
          valA = getRealPrice(a) ?? 0;
          valB = getRealPrice(b) ?? 0;
          break;
        case 'referencePrice':
          valA = getReferencePrice(a);
          valB = getReferencePrice(b);
          break;
        case 'status':
          valA = a.isActive ? 1 : 0;
          valB = b.isActive ? 1 : 0;
          break;
        case 'lastPurchaseDate':
          // Sin compras registradas se ordena por la fecha de alta del artículo
          valA = new Date(a.lastPurchaseDate ?? a.createdAt).getTime();
          valB = new Date(b.lastPurchaseDate ?? b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredProducts, sortField, sortDirection, tree, categoryNameMap]);

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
          <div className="flex gap-2 relative">
            <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white rounded-md transition-colors">
              Importar
            </button>
            <div className="relative group">
              <button className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white rounded-md transition-colors flex items-center gap-1">
                Exportar
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-lg rounded-md overflow-hidden z-50 hidden group-focus-within:block group-hover:block">
                <button onClick={exportToCSV} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                  Exportar a CSV
                </button>
                <button onClick={exportToExcel} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                  Exportar a Excel
                </button>
                <button onClick={exportToPDF} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                  Exportar a PDF
                </button>
              </div>
            </div>
            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
              Crear Artículo
            </button>
          </div>
        </div>

        {/* Chained Filters */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filtrar por fecha</label>
              <select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value as 'createdAt' | 'lastPurchaseDate')} className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                <option value="createdAt">Registro</option>
                <option value="lastPurchaseDate">Última Compra</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desde</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta</label>
              <div className="flex gap-2">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full flex-1 px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                {(startDate || endDate) && (
                  <button onClick={() => { setStartDate(''); setEndDate(''); }} className="px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-400 rounded-md transition-colors" title="Limpiar fechas">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
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
                  {renderSortableHeader('Precio Real', 'realPrice')}
                  {renderSortableHeader('Precio Ref.', 'referencePrice')}
                  {renderSortableHeader('Última Compra', 'lastPurchaseDate')}
                  {renderSortableHeader('Estado', 'status')}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {productsLoading ? (
                  <tr><td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Cargando...</td></tr>
                ) : sortedProducts.length === 0 ? (
                  <tr><td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay artículos</td></tr>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {getRealPrice(product) !== null
                            ? formatRefPrice(getRealPrice(product)!, product.referenceUnit)
                            : <span className="text-gray-400 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatRefPrice(getReferencePrice(product), product.referenceUnit)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.lastPurchaseDate ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                              {formatLastPurchaseDate(product.lastPurchaseDate)}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500" title="Sin compras registradas — fecha de alta del artículo">
                              {formatLastPurchaseDate(product.createdAt)}
                            </span>
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
                            onClick={() => handleDelete(product)}
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

      <ImportModal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); refetch(); }}
      />
    </div>
  );
}

/** Tarjeta de contexto para el diálogo de borrado: ancla la confirmación al artículo real. */
function ArticleContextCard({ product }: { product: Product }) {
  const refPrice = formatRefPrice(getReferencePrice(product), product.referenceUnit);
  const meta = [product.category?.name, refPrice].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-container-highest)]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Tag className="h-5 w-5 text-[var(--on-surface-variant)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--on-surface)]">{product.name}</p>
        {meta && <p className="truncate text-xs text-[var(--on-surface-variant)]">{meta}</p>}
      </div>
    </div>
  );
}
