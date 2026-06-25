'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useTechnicalSheets, type TechnicalSheetResponse } from '@/hooks/use-technical-sheets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Plus,
  RefreshCw,
  Edit,
  Loader2,
  Info,
  Package,
  Thermometer,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function TechnicalSheetsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { sheets, isLoading, error, refetch, createSheet, updateSheet, isCreating } = useTechnicalSheets();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState('');
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetDescription, setNewSheetDescription] = useState('');
  const [newSheetNumber, setNewSheetNumber] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Prevent isLoading if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const handleCreateSheet = async () => {
    if (!newSheetName.trim()) return;

    try {
      await createSheet({
        name: newSheetName,
        description: newSheetDescription || undefined,
        sheetNumber: newSheetNumber || undefined,
        recipeId: selectedRecipeId || undefined,
      });
      setIsCreateModalOpen(false);
      setNewSheetName('');
      setNewSheetDescription('');
      setNewSheetNumber('');
      setSelectedRecipeId('');
      refetch();
    } catch (error) {
      console.error('Error creating sheet:', error);
    }
  };

  const handleUpdateSheet = async (id: string) => {
    if (!newSheetName.trim()) return;

    try {
      await updateSheet({
        id,
        data: {
          name: newSheetName,
          description: newSheetDescription || undefined,
          sheetNumber: newSheetNumber || undefined,
          recipeId: selectedRecipeId || undefined,
        },
      });
      setIsEditMode(false);
      setEditingSheetId('');
      setNewSheetName('');
      setNewSheetDescription('');
      setNewSheetNumber('');
      setSelectedRecipeId('');
      setIsCreateModalOpen(false);
      refetch();
    } catch (error) {
      console.error('Error updating sheet:', error);
    }
  };

  const startEditSheet = (sheet: TechnicalSheetResponse) => {
    setEditingSheetId(sheet.id);
    setNewSheetName(sheet.name);
    setNewSheetDescription(sheet.description || '');
    setNewSheetNumber(sheet.sheetNumber || '');
    setSelectedRecipeId(sheet.recipeId || '');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleEditClose = () => {
    setIsEditMode(false);
    setEditingSheetId('');
    setNewSheetName('');
    setNewSheetDescription('');
    setNewSheetNumber('');
    setSelectedRecipeId('');
    setIsCreateModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
    const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      draft: { label: 'Borrador', variant: 'default' },
      published: { label: 'Publicado', variant: 'default' },
      archived: { label: 'Archivado', variant: 'secondary' },
    };
    const config = statusConfig[status.toLowerCase()] || { label: status, variant: 'secondary' as BadgeVariant };
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Fichas Técnicas</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de gestión de fichas técnicas para artículos
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
              <CardTitle>{isEditMode ? 'Editar Ficha Técnica' : 'Crear Nueva Ficha Técnica'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="Ej: Ficha técnica de producto XYZ"
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={newSheetDescription}
                  onChange={(e) => setNewSheetDescription(e.target.value)}
                  placeholder="Descripción de la ficha técnica"
                  rows={3}
                />
              </div>
              <div>
                <Label>Número de Ficha (opcional)</Label>
                <Input
                  value={newSheetNumber}
                  onChange={(e) => setNewSheetNumber(e.target.value)}
                  placeholder="Ej: FT-001"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleEditClose()} variant="outline">
                  Cancelar
                </Button>
                <Button
                  onClick={() => isEditMode ? handleUpdateSheet(editingSheetId) : handleCreateSheet()}
                  disabled={isCreating}
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isEditMode ? 'Guardar Cambios' : 'Crear Ficha'}
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
                    Crea tu primera ficha técnica para documentar artículos
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primera Ficha
                  </Button>
                </Card>
              ) : (
                sheets.map((sheet) => (
                  <Card key={sheet.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{sheet.name}</h3>
                          <Badge variant="outline">
                            <Info className="mr-1 h-3 w-3" />
                            {sheet.sheetNumber || 'Sin número'}
                          </Badge>
                          {getStatusBadge(sheet.status)}
                        </div>
                        {sheet.description && (
                          <p className="text-sm text-muted-foreground mb-2">{sheet.description}</p>
                        )}
                        {sheet.recipeName && (
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Receta: {sheet.recipeName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            <span>Creado: {new Date(sheet.createdAt).toLocaleDateString()}</span>
                          </div>
                          {sheet.ingredients && sheet.ingredients.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              <span>{sheet.ingredients.length} ingredientes</span>
                            </div>
                          )}
                          {sheet.temperatures && sheet.temperatures.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Thermometer className="h-4 w-4" />
                              <span>{sheet.temperatures.length} temperaturas</span>
                            </div>
                          )}
                        </div>
                        {sheet.ingredients && sheet.ingredients.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {sheet.ingredients.slice(0, 3).map((ingredient) => (
                              <Badge key={ingredient.id} variant="secondary" className="text-xs">
                                {ingredient.ingredientName}
                              </Badge>
                            ))}
                            {sheet.ingredients.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{sheet.ingredients.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEditSheet(sheet)}>
                          <Edit className="h-4 w-4" />
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