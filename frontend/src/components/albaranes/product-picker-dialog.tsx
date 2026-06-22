'use client';

import { useState } from 'react';
import { useProductSearch } from '@/hooks/use-product-search';
import { matchLine } from '@/lib/api-albaran';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Package, Check } from 'lucide-react';
import type { AlbaranLine } from '@/lib/api-albaran';

interface ProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albaranId: string;
  line: AlbaranLine;
  onSuccess: () => void;
}

export function ProductPickerDialog({
  open,
  onOpenChange,
  albaranId,
  line,
  onSuccess,
}: ProductPickerDialogProps) {
  const { products, loading, search, setSearch, error } = useProductSearch();
  const [matching, setMatching] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const handleSelectProduct = async (productId: string) => {
    setMatching(productId);
    setMatchError(null);
    try {
      await matchLine(albaranId, line.id, productId);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al asignar producto';
      setMatchError(message);
    } finally {
      setMatching(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Elegir Producto</DialogTitle>
          <DialogDescription>
            Selecciona un producto para asignar a: <strong>{line.description}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {matchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            {matchError}
          </div>
        )}

        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : search && products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron productos para "{search}"
            </div>
          ) : !search ? (
            <div className="text-center py-8 text-gray-500">
              Escribe para buscar productos
            </div>
          ) : (
            <div className="space-y-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product.id)}
                  disabled={matching === product.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    {matching === product.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    ) : (
                      <Package className="h-5 w-5 text-indigo-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {product.supplier && <span>{product.supplier.name}</span>}
                      {product.category && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" className="text-xs">
                            {product.category.name}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-indigo-600">
                      {formatCurrency(product.netPrice)}
                    </p>
                    <p className="text-xs text-gray-500">{product.referenceUnit}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
