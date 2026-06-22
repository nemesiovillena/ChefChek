import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Loader2, History, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog, ConfirmationDialogContent } from '@/components/ui/confirmation-dialog';
import { useSuppliers, type Supplier as ApiSupplier } from '@/hooks/use-suppliers';
import { useCreateSupplier, useUpdateSupplier, useDeleteSupplier, useToggleSupplierActive } from '@/hooks/use-supplier-mutations';
import { SupplierPriceTrendBadge } from './supplier-price-trend-badge';
import { SupplierPriceHistory } from './supplier-price-history-chart';
import { SupplierForm } from './supplier-form';
import apiClient from '@/lib/api-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SuppliersManagementModal({ isOpen, onClose }: Props) {
  const { data: suppliers, isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const toggleMutation = useToggleSupplierActive();

  const [editingSupplier, setEditingSupplier] = useState<ApiSupplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string; productCount?: number; products?: any[] } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [targetSupplierId, setTargetSupplierId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    try {
      // Obtener el número real de productos del proveedor
      const productCount = await getProductCount(id);
      setSupplierToDelete({
        id,
        name,
        productCount
      });
      setDeleteDialogOpen(true);
    } catch (error) {
      console.error('Error al obtener productos del proveedor:', error);
      setDeleteDialogOpen(true);
    }
  };

  // Función para obtener el número de productos de un proveedor
  const getProductCount = async (supplierId: string): Promise<number> => {
    try {
      const res = await apiClient.get(`/v1/products/suppliers/${supplierId}/products/count`);
      return res.data.count || 0;
    } catch (error) {
      console.error('Error al contar productos:', error);
      return 0;
    }
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;

    // Si tiene productos, mostrar diálogo de reasignación
    if (supplierToDelete.productCount !== undefined && supplierToDelete.productCount > 0) {
      setShowReassignDialog(true);
      return;
    }

    // Si no tiene productos, eliminar directamente
    try {
      await deleteMutation.mutateAsync(supplierToDelete.id);
      setNotification({
        type: 'success',
        title: 'Proveedor eliminado',
        message: `El proveedor "${supplierToDelete.name}" ha sido eliminado correctamente.`
      });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Error al eliminar proveedor';
      setNotification({
        type: 'error',
        title: 'Error al eliminar',
        message: errorMessage
      });
    }
  };

  const handleReassignAndDelete = async () => {
    if (!supplierToDelete || !targetSupplierId) return;

    try {
      // Reasignar productos
      await apiClient.put(`/v1/products/suppliers/${supplierToDelete.id}/products/reassign`, {
        targetSupplierId
      });

      // Eliminar proveedor
      await deleteMutation.mutateAsync(supplierToDelete.id);

      setNotification({
        type: 'success',
        title: 'Productos reasignados y proveedor eliminado',
        message: `${supplierToDelete.productCount || 0} producto${(supplierToDelete.productCount || 0) > 1 ? 's' : ''} reasignados correctamente. El proveedor "${supplierToDelete.name}" ha sido eliminado.`
      });

      setShowReassignDialog(false);
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      setTargetSupplierId(null);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Error al reasignar productos';
      setNotification({
        type: 'error',
        title: 'Error',
        message: errorMessage
      });
    }
  };

  // Reset cuando se cierra el diálogo
  useEffect(() => {
    if (!deleteDialogOpen) {
      setSupplierToDelete(null);
    }
  }, [deleteDialogOpen]);

  // Auto-ocultar notificaciones después de 5 segundos
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleToggleActive = async (supplier: ApiSupplier) => {
    try {
      await toggleMutation.mutateAsync({ id: supplier.id, isActive: !supplier.isActive });
      setNotification({
        type: 'success',
        title: 'Estado actualizado',
        message: `El proveedor "${supplier.name}" ha sido ${!supplier.isActive ? 'activado' : 'desactivado'}`
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Error al cambiar estado';
      setNotification({
        type: 'error',
        title: 'Error al cambiar estado',
        message: errorMessage
      });
    }
  };

  const handleEdit = (supplier: ApiSupplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingSupplier) {
        await updateMutation.mutateAsync({ id: editingSupplier.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      handleCancelForm();
    } catch (error: any) {
      alert(error.message || 'Error al guardar proveedor');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSupplierId(prev => prev === id ? null : id);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] lg:max-w-[1100px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Proveedores</DialogTitle>
        </DialogHeader>

        {/* Inline form panel */}
        {showForm && (
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingSupplier ? `Editar: ${editingSupplier.name}` : 'Nuevo proveedor'}
              </h3>
              <button
                onClick={handleCancelForm}
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <SupplierForm
              supplier={editingSupplier ? {
                ...editingSupplier,
                priceTier: (editingSupplier.priceTier as 'LOW' | 'MEDIUM' | 'HIGH'),
                preferredStatus: (editingSupplier.preferredStatus as 'PREFERRED' | 'ALTERNATIVE' | 'EXCLUDED')
              } : null}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        )}

        {/* List header */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {suppliers?.filter(s => s.isActive).length ?? 0} activos de {suppliers?.length ?? 0} totales
          </p>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        </div>

        {/* Supplier list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : suppliers?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay proveedores. Crea el primero.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden mt-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-3" />
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tendencia</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {suppliers?.map(supplier => {
                  const isExpanded = expandedSupplierId === supplier.id;
                  return (
                    <SupplierRow
                      key={supplier.id}
                      supplier={supplier}
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleExpand(supplier.id)}
                      onToggleActive={() => handleToggleActive(supplier)}
                      onEdit={() => handleEdit(supplier)}
                      onDelete={() => handleDelete(supplier.id, supplier.name)}
                      isToggling={toggleMutation.isPending}
                      isDeleting={deleteMutation.isPending}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Componente de notificación */}
    {notification && (
      <div className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
        notification.type === 'success'
          ? 'bg-green-50 text-green-900 border border-green-200'
          : 'bg-red-50 text-red-900 border border-red-200'
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{notification.title}</p>
            <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        supplierName={supplierToDelete?.name || ''}
        productCount={supplierToDelete?.productCount}
        isDeleting={deleteMutation.isPending}
      />

      <ReassignProductsDialog
        isOpen={showReassignDialog}
        onClose={() => {
          setShowReassignDialog(false);
          setTargetSupplierId(null);
        }}
        onConfirm={handleReassignAndDelete}
        supplierName={supplierToDelete?.name || ''}
        productCount={supplierToDelete?.productCount || 0}
        supplierId={supplierToDelete?.id || ''}
        targetSupplierId={targetSupplierId}
        setTargetSupplierId={setTargetSupplierId}
        suppliers={suppliers || []}
        isProcessing={deleteMutation.isPending}
      />
    </>
  );
}

/** Individual supplier row with expandable price history */
function SupplierRow({
  supplier,
  isExpanded,
  onToggleExpand,
  onToggleActive,
  onEdit,
  onDelete,
  isToggling,
  isDeleting,
}: {
  supplier: ApiSupplier;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50/60 transition-colors border-t">
        <td className="px-2 py-3">
          <button
            onClick={onToggleExpand}
            className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
            title={isExpanded ? 'Ocultar histórico' : 'Ver histórico de precios'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </td>
        <td className="px-5 py-3">
          <div>
            <p className="font-medium text-gray-900">{supplier.name}</p>
            {supplier.website && (
              <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:underline">
                Web ↗
              </a>
            )}
          </div>
        </td>
        <td className="px-5 py-3 text-gray-600">
          {supplier.contactPerson || '—'}
          {supplier.email && (
            <p className="text-xs text-gray-400">{supplier.email}</p>
          )}
        </td>
        <td className="px-5 py-3 text-gray-600">
          {supplier.phone || supplier.whatsapp || '—'}
        </td>
        <td className="px-5 py-3">
          <button
            onClick={onToggleActive}
            disabled={isToggling}
            className={`px-3 py-1 inline-flex items-center gap-1.5 text-xs leading-5 font-semibold rounded-lg cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150 ${
              supplier.isActive
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
            title={supplier.isActive ? 'Desactivar proveedor' : 'Activar proveedor'}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span className={`w-2 h-2 rounded-full ${
                  supplier.isActive ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </>
            )}
          </button>
        </td>
        <td className="px-5 py-3">
          <SupplierPriceTrendBadge supplierId={supplier.id} />
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={onToggleExpand}
              title="Histórico de precios"
              className="w-9 h-9 inline-flex items-center justify-center border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={onEdit}
              title="Editar proveedor"
              className="w-9 h-9 inline-flex items-center justify-center border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              title="Eliminar proveedor"
              className="w-9 h-9 inline-flex items-center justify-center border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded price history row */}
      {isExpanded && (
        <tr className="border-t">
          <td colSpan={7} className="bg-white px-8 py-5 border-l-4 border-indigo-300">
            <SupplierPriceHistory
              supplierId={supplier.id}
              supplierName={supplier.name}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// Diálogo de confirmación de eliminación moderna
function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  supplierName,
  productCount,
  isDeleting
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  supplierName: string;
  productCount?: number;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;

  const productCountNum = productCount || 0;
  const hasProducts = productCountNum > 0;

  return (
    <ConfirmationDialog open={isOpen} onOpenChange={onClose}>
      <ConfirmationDialogContent
        title="Eliminar Proveedor"
        description={hasProducts
          ? `Este proveedor tiene ${productCountNum} producto${productCountNum > 1 ? 's' : ''} asociados.`
          : `¿Estás seguro de eliminar "${supplierName}"?`}
        confirmText={isDeleting ? "Eliminando..." : "Eliminar"}
        cancelText="Cancelar"
        variant={hasProducts ? 'warning' : 'destructive'}
        confirmButtonClassName={isDeleting ? "opacity-75 cursor-not-allowed" : ""}
        showDetails={hasProducts}
        details={
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">No se puede eliminar</p>
                <p className="text-amber-700">Para eliminar este proveedor, primero reasigna o elimina sus productos asociados.</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Productos asociados:</span>
              <Badge variant="secondary" className="text-amber-700 bg-amber-100">
                {productCountNum} producto{productCountNum > 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        }
      >
        {hasProducts && (
          <div className="text-sm text-gray-500 mt-2">
            <p>💡 Sugerencia: Puedes editar los productos y cambiarles de proveedor antes de eliminar.</p>
          </div>
        )}
      </ConfirmationDialogContent>
    </ConfirmationDialog>
  );
}

// Diálogo de reasignación de productos
function ReassignProductsDialog({
  isOpen,
  onClose,
  onConfirm,
  supplierName,
  productCount,
  supplierId,
  targetSupplierId,
  setTargetSupplierId,
  suppliers,
  isProcessing
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  supplierName: string;
  productCount: number;
  supplierId: string;
  targetSupplierId: string | null;
  setTargetSupplierId: (id: string | null) => void;
  suppliers: ApiSupplier[];
  isProcessing: boolean;
}) {
  const availableSuppliers = suppliers.filter(s => s.id !== supplierId);

  if (!isOpen) return null;

  return (
    <ConfirmationDialog open={isOpen} onOpenChange={onClose}>
      <ConfirmationDialogContent
        title="Reasignar Productos"
        description={`Este proveedor tiene ${productCount} producto${productCount > 1 ? 's' : ''} asociados. Selecciona otro proveedor para reasignar estos productos antes de eliminar.`}
        confirmText={isProcessing ? "Reasignando..." : "Reasignar y Eliminar"}
        cancelText="Cancelar"
        variant="warning"
        confirmButtonClassName={isProcessing ? "opacity-75 cursor-not-allowed" : ""}
        showDetails={true}
        details={
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proveedor destino:
              </label>
              <select
                value={targetSupplierId || ""}
                onChange={(e) => setTargetSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={isProcessing}
              >
                <option value="">Seleccionar proveedor...</option>
                {availableSuppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} {supplier.isActive ? '' : '(Inactivo)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-800">
                💡 Los productos serán movidos al proveedor seleccionado. Luego el proveedor "{supplierName}" será eliminado.
              </p>
            </div>
          </div>
        }
        onConfirm={() => targetSupplierId && onConfirm()}
      />
    </ConfirmationDialog>
  );
}
