'use client';

import { useState, useRef } from 'react';
import { useNotification } from '@/components/notification-system';
import { useApiMutation } from '@/hooks/use-api';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MappedProduct {
  name: string;
  description: string;
  categoryName: string;
  supplierName: string;
  purchasePrice: number;
  iva: number;
  purchaseFormat: string;
  referenceUnit: string;
  unitsPerFormat: number;
  referenceUnitSize: number;
  barcode: string;
  brand: string;
  minimumStock?: number;
  maximumStock?: number;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [productsToImport, setProductsToImport] = useState<MappedProduct[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addNotification = useNotification();

  const importMutation = useApiMutation<{ success: boolean; count: number; message: string }, { products: MappedProduct[] }>(
    '/v1/products/bulk',
    'POST'
  );

  if (!isOpen) return null;

  // Descargar plantilla CSV de ejemplo
  const downloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      'Nombre;Descripción;Categoría;Proveedor;Precio Compra;IVA;Formato;Unidad;Unidades Por Formato;Tamaño Unidad;Código Barras;Marca;Stock Mínimo;Stock Máximo',
      'Aceite de Oliva 5L;Aceite de oliva virgen extra;Abarrotes;Proveedor Aceites;24.50;10;Garrafa 5L;L;1;5;8410000000001;La Española;2;10',
      'Harina de Trigo 25kg;Harina de fuerza para repostería;Abarrotes;Proveedor Harinas;18.90;4;Saco 25kg;kg;1;25;;Harimsa;1;5',
      'Leche Entera 1L;Caja de 6 botellas de leche;Lácteos;Proveedor Lácteos;6.80;4;Caja 6und;L;6;1;8420000000002;Pascual;5;20'
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'plantilla_importacion_articulos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parser de CSV robusto
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === ';') && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentValue.trim());
        if (row.length > 0 && row.some(cell => cell !== '')) {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    if (currentValue || row.length > 0) {
      row.push(currentValue.trim());
      if (row.some(cell => cell !== '')) {
        lines.push(row);
      }
    }
    return lines;
  };

  // Parser de XML robusto
  const parseXML = (text: string): MappedProduct[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      throw new Error('El archivo XML no tiene un formato estructurado o válido.');
    }

    const root = xmlDoc.documentElement;
    const items: MappedProduct[] = [];
    
    const getTagValue = (parent: Element, tagName: string): string => {
      const normalizedTarget = tagName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        const normalizedChildName = child.tagName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedChildName === normalizedTarget || normalizedChildName.includes(normalizedTarget)) {
          return child.textContent?.trim() || '';
        }
      }
      return '';
    };

    const findItemNodes = (node: Element): Element[] => {
      const list: Element[] = [];
      const hasNameChild = Array.from(node.children).some(child => {
        const name = child.tagName.toLowerCase();
        return name.includes('nombre') || name === 'name';
      });
      
      if (hasNameChild) {
        list.push(node);
      } else {
        for (let i = 0; i < node.children.length; i++) {
          list.push(...findItemNodes(node.children[i]));
        }
      }
      return list;
    };

    const itemNodes = findItemNodes(root);

    if (itemNodes.length === 0) {
      throw new Error('No se encontraron elementos de artículos en el XML. Asegúrate de incluir etiquetas de <nombre> o <name> en los elementos.');
    }

    for (let i = 0; i < itemNodes.length; i++) {
      const node = itemNodes[i];
      const name = getTagValue(node, 'nombre') || getTagValue(node, 'name');
      
      if (!name) continue;

      const purchasePriceStr = getTagValue(node, 'precio compra') || getTagValue(node, 'precio') || getTagValue(node, 'compra') || getTagValue(node, 'purchasePrice') || '0';
      const purchasePrice = parseFloat(purchasePriceStr.replace(',', '.'));
      
      const unitsPerFormat = parseInt(getTagValue(node, 'unidades por formato') || getTagValue(node, 'unidades formato') || getTagValue(node, 'unitsPerFormat')) || 1;
      const referenceUnitSize = parseFloat((getTagValue(node, 'tamano unidad') || getTagValue(node, 'tamano') || getTagValue(node, 'tamaño') || getTagValue(node, 'referenceUnitSize')).replace(',', '.')) || 1;
      const iva = parseFloat(getTagValue(node, 'iva')) || 10;
      
      const minimumStockStr = getTagValue(node, 'minimo') || getTagValue(node, 'stock minimo') || getTagValue(node, 'minimumStock');
      const maximumStockStr = getTagValue(node, 'maximo') || getTagValue(node, 'stock maximo') || getTagValue(node, 'maximumStock');
      const minimumStock = minimumStockStr !== '' ? parseFloat(minimumStockStr) : undefined;
      const maximumStock = maximumStockStr !== '' ? parseFloat(maximumStockStr) : undefined;

      items.push({
        name,
        description: getTagValue(node, 'descripcion') || getTagValue(node, 'description') || '',
        categoryName: getTagValue(node, 'categoria') || getTagValue(node, 'category') || '',
        supplierName: getTagValue(node, 'proveedor') || getTagValue(node, 'supplier') || '',
        purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
        iva,
        purchaseFormat: getTagValue(node, 'formato') || getTagValue(node, 'format') || '',
        referenceUnit: getTagValue(node, 'unidad') || getTagValue(node, 'unit') || 'kilo',
        unitsPerFormat,
        referenceUnitSize,
        barcode: getTagValue(node, 'barras') || getTagValue(node, 'codigo') || getTagValue(node, 'barcode') || '',
        brand: getTagValue(node, 'marca') || getTagValue(node, 'brand') || '',
        minimumStock: isNaN(minimumStock as number) ? undefined : minimumStock,
        maximumStock: isNaN(maximumStock as number) ? undefined : maximumStock
      });
    }

    return items;
  };

  // Mapear los datos parseados
  const processCSVData = (lines: string[][]) => {
    if (lines.length < 2) {
      setErrors(['El archivo CSV está vacío o le falta la cabecera']);
      return;
    }

    const headers = lines[0].map(h => h.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')); // Remover acentos

    const mappedProducts: MappedProduct[] = [];
    const validationErrors: string[] = [];

    // Mapear cabeceras a índices
    const nameIdx = headers.findIndex(h => h.includes('nombre'));
    const descIdx = headers.findIndex(h => h.includes('descripcion') || h.includes('detalle'));
    const catIdx = headers.findIndex(h => h.includes('categoria'));
    const supIdx = headers.findIndex(h => h.includes('proveedor'));
    const priceIdx = headers.findIndex(h => h.includes('precio compra') || h.includes('precio') || h.includes('compra'));
    const ivaIdx = headers.findIndex(h => h.includes('iva'));
    const formatIdx = headers.findIndex(h => h.includes('formato'));
    const unitIdx = headers.findIndex(h => h.includes('unidad'));
    const unitsPerFormatIdx = headers.findIndex(h => h.includes('unidades por formato') || h.includes('unidades formato') || h.includes('unidades/formato'));
    const refSizeIdx = headers.findIndex(h => h.includes('tamano unidad') || h.includes('tamano') || h.includes('tamaño') || h.includes('size'));
    const barcodeIdx = headers.findIndex(h => h.includes('barras') || h.includes('codigo') || h.includes('barcode'));
    const brandIdx = headers.findIndex(h => h.includes('marca'));
    const minStockIdx = headers.findIndex(h => h.includes('minimo') || h.includes('stock minimo'));
    const maxStockIdx = headers.findIndex(h => h.includes('maximo') || h.includes('stock maximo'));

    if (nameIdx === -1) {
      setErrors(['La columna obligatoria "Nombre" no se encuentra en el archivo']);
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

      const name = row[nameIdx];
      if (!name || !name.trim()) {
        validationErrors.push(`Fila ${i + 1}: El campo "Nombre" es obligatorio.`);
        continue;
      }

      const purchasePriceStr = priceIdx !== -1 ? row[priceIdx] : '0';
      const purchasePrice = parseFloat(purchasePriceStr.replace(',', '.'));
      if (isNaN(purchasePrice)) {
        validationErrors.push(`Fila ${i + 1}: El precio de compra "${purchasePriceStr}" no es un número válido.`);
        continue;
      }

      const unitsPerFormat = unitsPerFormatIdx !== -1 ? parseInt(row[unitsPerFormatIdx]) || 1 : 1;
      const referenceUnitSize = refSizeIdx !== -1 ? parseFloat(row[refSizeIdx].replace(',', '.')) || 1 : 1;
      const iva = ivaIdx !== -1 ? parseFloat(row[ivaIdx]) || 10 : 10;
      const minimumStock = minStockIdx !== -1 && row[minStockIdx] !== '' ? parseFloat(row[minStockIdx]) : undefined;
      const maximumStock = maxStockIdx !== -1 && row[maxStockIdx] !== '' ? parseFloat(row[maxStockIdx]) : undefined;

      mappedProducts.push({
        name,
        description: descIdx !== -1 ? row[descIdx] : '',
        categoryName: catIdx !== -1 ? row[catIdx] : '',
        supplierName: supIdx !== -1 ? row[supIdx] : '',
        purchasePrice,
        iva,
        purchaseFormat: formatIdx !== -1 ? row[formatIdx] : '',
        referenceUnit: unitIdx !== -1 ? row[unitIdx] : 'kilo',
        unitsPerFormat,
        referenceUnitSize,
        barcode: barcodeIdx !== -1 ? row[barcodeIdx] : '',
        brand: brandIdx !== -1 ? row[brandIdx] : '',
        minimumStock,
        maximumStock
      });
    }

    setProductsToImport(mappedProducts);
    setErrors(validationErrors);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const isXml = selectedFile.name.toLowerCase().endsWith('.xml');
      
      try {
        if (isXml) {
          const parsed = parseXML(text);
          setProductsToImport(parsed);
        } else {
          const lines = parseCSV(text);
          processCSVData(lines);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error al procesar el archivo';
        setErrors([errMsg]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (productsToImport.length === 0) return;

    try {
      const response = await importMutation.mutateAsync({ products: productsToImport });
      setSuccessCount(response.count);
      addNotification({
        type: 'success',
        title: 'Importación completada',
        message: response.message
      });
      setFile(null);
      setProductsToImport([]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al procesar la importación masiva';
      setErrors([errMsg]);
      addNotification({
        type: 'error',
        title: 'Error de importación',
        message: errMsg
      });
    }
  };

  const resetModal = () => {
    setFile(null);
    setProductsToImport([]);
    setErrors([]);
    setSuccessCount(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-lg shadow-xl overflow-hidden flex flex-col border border-gray-200 dark:border-zinc-800 animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Importar Artículos</h3>
          <button onClick={resetModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sube un archivo en formato **CSV** o **XML** estructurado. Los proveedores y categorías que no existan se crearán automáticamente.
          </p>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline"
          >
            <FileText className="h-4 w-4" />
            Descargar plantilla de ejemplo (CSV)
          </button>

          {/* Drag & Drop Area */}
          <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-850 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer"
               onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xml"
              className="hidden"
            />
            <Upload className="h-10 w-10 text-gray-400 mb-2" />
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              {file ? file.name : 'Haz clic para seleccionar o arrastra el archivo CSV o XML'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Máximo 5MB
            </span>
          </div>

          {/* Success message */}
          {successCount !== null && (
            <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 p-4 rounded-md text-sm">
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">¡Éxito!</span> Se han importado correctamente {successCount} artículos en la base de datos.
              </div>
            </div>
          )}

          {/* Errors list */}
          {errors.length > 0 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 p-4 rounded-md text-sm max-h-48 overflow-y-auto">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Errores encontrados:</span>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {errors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {errors.length > 10 && <li>...y {errors.length - 10} errores más.</li>}
                </ul>
              </div>
            </div>
          )}

          {/* Preview list */}
          {productsToImport.length > 0 && errors.length === 0 && (
            <div className="border border-gray-200 dark:border-zinc-800 rounded-md overflow-hidden">
              <div className="bg-gray-50 dark:bg-zinc-800 px-4 py-2 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                Previsualización de importación ({productsToImport.length} artículos)
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
                {productsToImport.map((p, idx) => (
                  <div key={idx} className="px-4 py-2 text-xs flex justify-between dark:text-zinc-400">
                    <span className="font-medium truncate max-w-[200px]">{p.name}</span>
                    <span className="text-gray-500">
                      {p.purchasePrice.toFixed(2)} &euro; - {p.categoryName || 'Sin categoría'} - {p.supplierName || 'Sin proveedor'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
          <button
            onClick={resetModal}
            className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleImport}
            disabled={productsToImport.length === 0 || errors.length > 0 || importMutation.isPending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {importMutation.isPending ? 'Importando...' : 'Confirmar Importación'}
          </button>
        </div>

      </div>
    </div>
  );
}
