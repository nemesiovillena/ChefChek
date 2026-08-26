'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useTechnicalSheets, type TechnicalSheetDocument } from '@/hooks/use-technical-sheets';
import { useRecipeOptions } from '@/hooks/use-recipes';
import apiClient from '@/lib/api-client';
import SubRecipeCombobox from '@/app/dashboard/recipes/components/sub-recipe-combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Loader2,
  Info,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function TechnicalSheetsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const confirm = useConfirm();
  const addNotification = useNotification();
  const { sheets, isLoading, error, refetch, generateSheet, isGenerating, deleteSheet } =
    useTechnicalSheets();
  const { data: recipeOptions } = useRecipeOptions();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const recipeName = (recipeId?: string) =>
    recipeOptions?.find((r) => r.id === recipeId)?.name;

  // El PDF no queda persistido: cada "ver" vuelve a generarlo con el mismo
  // recipeId, igual que el botón "Ficha" en Recetas. La pestaña se abre
  // SÍNCRONAMENTE dentro del gesto del usuario: iOS Safari bloquea
  // window.open llamado tras un await.
  const openPdf = async (recipeId: string, errorMessage: string) => {
    const win = window.open('', '_blank');
    if (!win) {
      addNotification({
        type: 'error',
        title: 'Ventana bloqueada',
        message: 'El navegador bloqueó la ventana emergente. Permite popups para este sitio e inténtalo de nuevo.',
      });
      return;
    }
    win.document.write(
      '<!doctype html><html><head><title>Generando PDF…</title></head>'
      + '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666">Generando PDF…</body></html>',
    );
    try {
      const response = await apiClient.post(
        '/v1/technical-sheets/generate',
        { recipeId, includeAllergens: true, includeCosts: true },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      );
      win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win.close();
      addNotification({ type: 'error', title: 'Error', message: errorMessage });
    }
  };

  const handleCreateSheet = async () => {
    if (!selectedRecipeId) return;
    try {
      await generateSheet(selectedRecipeId);
      setIsCreateModalOpen(false);
      setSelectedRecipeId('');
      addNotification({
        type: 'success',
        title: 'Ficha generada',
        message: 'La ficha técnica se generó correctamente.',
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'No se pudo generar la ficha técnica.',
      });
    }
  };

  const handleView = async (sheet: TechnicalSheetDocument) => {
    if (!sheet.recipeId) return;
    setDownloadingId(sheet.id);
    await openPdf(sheet.recipeId, 'No se pudo generar la ficha técnica');
    setDownloadingId(null);
  };

  const handleDelete = async (sheet: TechnicalSheetDocument) => {
    const ok = await confirm({
      title: 'Eliminar ficha técnica',
      description: `¿Estás seguro de eliminar "${sheet.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteSheet(sheet.id);
      addNotification({ type: 'success', title: 'Ficha eliminada', message: sheet.name });
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la ficha técnica.',
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Fichas Técnicas</h1>
        <p className="text-muted-foreground mt-1">
          Historial de fichas técnicas generadas para recetas
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Lista de Fichas Técnicas</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Ficha
            </Button>
          </div>
        </div>

        {isCreateModalOpen && (
          <Card className="p-6">
            <CardHeader>
              <CardTitle>Generar Ficha Técnica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <SubRecipeCombobox
                  items={recipeOptions || []}
                  value={selectedRecipeId}
                  label={recipeName(selectedRecipeId)}
                  onSelect={(item) => setSelectedRecipeId(item.id)}
                  placeholder="Selecciona una receta..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setSelectedRecipeId('');
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateSheet} disabled={isGenerating || !selectedRecipeId}>
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Generar Ficha
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No se pudieron cargar las fichas técnicas. Por favor intenta nuevamente.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="grid gap-4">
              {sheets.length === 0 ? (
                <Card className="p-12 flex flex-col items-center justify-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sin fichas técnicas</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Genera tu primera ficha técnica para documentar una receta
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Generar Primera Ficha
                  </Button>
                </Card>
              ) : (
                sheets.map((sheet) => (
                  <Card key={sheet.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{sheet.name}</h3>
                          <Badge variant="outline">v{sheet.version}</Badge>
                        </div>
                        {recipeName(sheet.recipeId) && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Receta: {recipeName(sheet.recipeId)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Info className="h-4 w-4" />
                          <span>Generado: {new Date(sheet.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!sheet.recipeId || downloadingId === sheet.id}
                          onClick={() => handleView(sheet)}
                          title="Ver / descargar PDF"
                        >
                          {downloadingId === sheet.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(sheet)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
