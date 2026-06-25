'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useAllergens, type AllergenResponse } from '@/hooks/use-allergens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Edit,
  Loader2,
  Info,
  Tag,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AllergensPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { allergens, isLoading, error, refetch, createAllergen, updateAllergen, isCreating } = useAllergens();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAllergenId, setEditingAllergenId] = useState(0);
  const [newAllergenName, setNewAllergenName] = useState('');
  const [newAllergenNameEu1169, setNewAllergenNameEu1169] = useState('');
  const [newAllergenDescription, setNewAllergenDescription] = useState('');
  const [newAllergenIcon, setNewAllergenIcon] = useState('');

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

  const handleCreateAllergen = async () => {
    if (!newAllergenName.trim()) return;

    try {
      await createAllergen({
        name: newAllergenName,
        nameEu1169: newAllergenNameEu1169 || undefined,
        description: newAllergenDescription || undefined,
        icon: newAllergenIcon || undefined,
      });
      setIsCreateModalOpen(false);
      setNewAllergenName('');
      setNewAllergenNameEu1169('');
      setNewAllergenDescription('');
      setNewAllergenIcon('');
      refetch();
    } catch (error) {
      console.error('Error creating allergen:', error);
    }
  };

  const handleUpdateAllergen = async (id: number) => {
    if (!newAllergenName.trim()) return;

    try {
      await updateAllergen({
        id,
        data: {
          name: newAllergenName,
          nameEu1169: newAllergenNameEu1169 || undefined,
          description: newAllergenDescription || undefined,
          icon: newAllergenIcon || undefined,
        },
      });
      setIsEditMode(false);
      setEditingAllergenId(0);
      setNewAllergenName('');
      setNewAllergenNameEu1169('');
      setNewAllergenDescription('');
      setNewAllergenIcon('');
      setIsCreateModalOpen(false);
      refetch();
    } catch (error) {
      console.error('Error updating allergen:', error);
    }
  };

  const startEditAllergen = (allergen: AllergenResponse) => {
    setEditingAllergenId(allergen.id);
    setNewAllergenName(allergen.name);
    setNewAllergenNameEu1169(allergen.nameEu1169 || '');
    setNewAllergenDescription(allergen.description || '');
    setNewAllergenIcon(allergen.icon || '');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleEditClose = () => {
    setIsEditMode(false);
    setEditingAllergenId(0);
    setNewAllergenName('');
    setNewAllergenNameEu1169('');
    setNewAllergenDescription('');
    setNewAllergenIcon('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Alérgenos</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de gestión de alérgenos - Cumplimiento UE 1169/2011
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Lista de Alérgenos</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Alérgeno
            </Button>
          </div>
        </div>

        {isCreateModalOpen && (
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{isEditMode ? 'Editar Alérgeno' : 'Crear Nuevo Alérgeno'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={newAllergenName}
                  onChange={(e) => setNewAllergenName(e.target.value)}
                  placeholder="Ej: Gluten, Lácteos, etc."
                />
              </div>
              <div>
                <Label>Nombre UE 1169/2011 (opcional)</Label>
                <Input
                  value={newAllergenNameEu1169}
                  onChange={(e) => setNewAllergenNameEu1169(e.target.value)}
                  placeholder="Nombre oficial según normativa UE"
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={newAllergenDescription}
                  onChange={(e) => setNewAllergenDescription(e.target.value)}
                  placeholder="Descripción del alérgeno"
                  rows={3}
                />
              </div>
              <div>
                <Label>Ícono (opcional)</Label>
                <Input
                  value={newAllergenIcon}
                  onChange={(e) => setNewAllergenIcon(e.target.value)}
                  placeholder="Ej: 🌾, 🥛, 🥚"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleEditClose()} variant="outline">
                  Cancelar
                </Button>
                <Button
                  onClick={() => isEditMode ? handleUpdateAllergen(editingAllergenId) : handleCreateAllergen()}
                  disabled={isCreating}
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isEditMode ? 'Guardar Cambios' : 'Crear Alérgeno'}
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
              No se pudieron cargar los alérgenos. Por favor intenta nuevamente.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="grid gap-4">
              {allergens.length === 0 ? (
                <Card className="p-12 flex flex-col items-center justify-center">
                  <Tag className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sin alérgenos</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Crea tu primer alérgeno para comenzar a gestionar la seguridad alimentaria
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primer Alérgeno
                  </Button>
                </Card>
              ) : (
                allergens.map((allergen) => (
                  <Card key={allergen.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{allergen.icon || '⚠️'}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{allergen.name}</h3>
                            <Badge variant={allergen.isActive ? 'default' : 'secondary'}>
                              {allergen.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {allergen.nameEu1169 && (
                              <Badge variant="outline">
                                UE 1169/2011
                              </Badge>
                            )}
                          </div>
                          {allergen.nameEu1169 && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {allergen.nameEu1169}
                            </p>
                          )}
                          {allergen.description && (
                            <p className="text-sm text-muted-foreground mb-2">{allergen.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              <span>Creado: {new Date(allergen.createdAt).toLocaleDateString()}</span>
                            </div>
                            {allergen.productsCount !== undefined && (
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4" />
                                <span>{allergen.productsCount} artículos</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEditAllergen(allergen)}>
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