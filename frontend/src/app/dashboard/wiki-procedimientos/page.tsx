'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Plus,
  FileText,
  Edit,
  Trash2,
  History,
  Archive,
  FolderOpen,
  Tag,
  Clock,
  User,
  Eye,
  Shield,
  Download,
  RefreshCw,
  Save,
} from 'lucide-react';

enum WikiStep {
  DOCUMENTS = 'DOCUMENTS',
  EDITOR = 'EDITOR',
  SEARCH = 'SEARCH',
  VERSIONS = 'VERSIONS',
  PERMISSIONS = 'PERMISSIONS',
}

const wikiSteps = [
  { id: WikiStep.DOCUMENTS, label: 'Documentos', icon: FileText },
  { id: WikiStep.EDITOR, label: 'Editor', icon: Edit },
  { id: WikiStep.SEARCH, label: 'Búsqueda', icon: Search },
  { id: WikiStep.VERSIONS, label: 'Versiones', icon: History },
  { id: WikiStep.PERMISSIONS, label: 'Permisos', icon: Shield },
];

interface WikiDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  version: number;
  viewCount: number;
  createdBy: string;
}

interface WikiCategory {
  id: string;
  name: string;
  description: string;
  documentCount: number;
}

interface WikiVersion {
  id: string;
  version: number;
  changeNote: string;
  createdAt: string;
  createdBy: string;
}

interface WikiSearchResult {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  score: number;
}

export const dynamic = 'force-dynamic';

export default function WikiProcedimientosPage() {
  const router = useRouter();
  const { session, isAuthenticated, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(WikiStep.DOCUMENTS);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Prevent loading if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [documents, setDocuments] = useState<WikiDocument[]>([]);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [searchResults, setSearchResults] = useState<WikiSearchResult[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<WikiDocument | null>(null);
  const [documentVersions, setDocumentVersions] = useState<WikiVersion[]>([]);

  // Editor states
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newTags, setNewTags] = useState('');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  useEffect(() => {
    loadWikiData();
  }, []);

  const loadWikiData = async () => {
    if (!session?.id) {
      console.error('No session available');
      return;
    }

    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${session.id}`,
        'Content-Type': 'application/json',
      };

      const [docsResponse, catsResponse] = await Promise.all([
        fetch('/api/v1/wiki/documents', { headers }),
        fetch('/api/v1/wiki/categories', { headers }),
      ]);

      const [docsData, catsData] = await Promise.all([
        docsResponse.json(),
        catsResponse.json(),
      ]);

      setDocuments(docsData);
      setCategories(catsData);
    } catch (error) {
      console.error('Error loading wiki data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWikiData();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch('/api/v1/wiki/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          category: searchCategory || undefined,
        }),
      });

      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching documents:', error);
    }
  };

  const handleCreateDocument = async () => {
    try {
      const response = await fetch('/api/v1/wiki/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          category: newCategory,
          tags: newTags.split(',').map(t => t.trim()).filter(t => t),
          tenantId: 'default-tenant-id',
        }),
      });

      if (response.ok) {
        await loadWikiData();
        setIsCreating(false);
        setNewTitle('');
        setNewContent('');
        setNewCategory('');
        setNewTags('');
      }
    } catch (error) {
      console.error('Error creating document:', error);
    }
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;

    try {
      const response = await fetch(`/api/v1/wiki/documents/${selectedDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          category: newCategory,
          tags: newTags.split(',').map(t => t.trim()).filter(t => t),
          changeNote: 'Updated via wiki editor',
        }),
      });

      if (response.ok) {
        await loadWikiData();
        setIsEditing(false);
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      const response = await fetch(`/api/v1/wiki/documents/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadWikiData();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleArchiveDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/wiki/documents/${id}/archive`, {
        method: 'PUT',
      });

      if (response.ok) {
        await loadWikiData();
      }
    } catch (error) {
      console.error('Error archiving document:', error);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedDocument) return;

    try {
      const response = await fetch(`/api/v1/wiki/documents/${selectedDocument.id}/restore/${versionId}`, {
        method: 'PUT',
      });

      if (response.ok) {
        await loadWikiData();
        await loadDocumentVersions(selectedDocument.id);
      }
    } catch (error) {
      console.error('Error restoring version:', error);
    }
  };

  const handleSelectDocument = (document: WikiDocument) => {
    setSelectedDocument(document);
    setNewTitle(document.title);
    setNewContent(document.content);
    setNewCategory(document.category);
    setNewTags(document.tags.join(', '));
    setIsEditing(true);
    setCurrentStep(WikiStep.EDITOR);
  };

  const loadDocumentVersions = async (documentId: string) => {
    try {
      const response = await fetch(`/api/v1/wiki/documents/${documentId}/versions`);
      const versions = await response.json();
      setDocumentVersions(versions);
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  const getStepIndex = (step: WikiStep) => wikiSteps.findIndex((s) => s.id === step);

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-4">
        {wikiSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium text-center">{step.label}</span>
              </button>
              {index < wikiSteps.length - 1 && <div className="w-12 h-1 bg-gray-300" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Documentos Wiki</h3>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreating(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Documento
          </Button>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{doc.title}</CardTitle>
                <Badge variant={doc.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                  {doc.status}
                </Badge>
              </div>
              <CardDescription>{doc.category.replace(/_/g, ' ')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Tag className="w-4 h-4" />
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {doc.tags.length > 3 && <span className="text-xs">+{doc.tags.length - 3} más</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Eye className="w-4 h-4" />
                  <span>{doc.viewCount} vistas</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <History className="w-4 h-4" />
                  <span>v{doc.version}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => handleSelectDocument(doc)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleArchiveDocument(doc.id)}>
                    <Archive className="w-4 h-4 mr-1" />
                    Archivar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteDocument(doc.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Document Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Título</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Procedimiento de limpieza de cocina"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Categoría</label>
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.documentCount} documentos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Etiquetas (separadas por comas)</label>
              <Input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Ej: limpieza, cocina, procedimiento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contenido (Markdown)</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="# Título

## Paso 1: ..."
                className="min-h-[400px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDocument}>
                Crear Documento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderEditor = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">
          {isEditing ? 'Editar Documento' : 'Editor'}
        </h3>
        <div className="flex gap-2">
          <Button onClick={() => setSelectedDocument(null)} variant="outline" size="sm">
            Cancelar
          </Button>
          <Button onClick={isEditing ? handleUpdateDocument : handleCreateDocument} size="sm">
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Guardar Cambios' : 'Crear Documento'}
          </Button>
        </div>
      </div>

      {selectedDocument && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Título</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título del documento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Categoría</label>
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Etiquetas (separadas por comas)</label>
              <Input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Etiquetas separadas por comas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contenido (Markdown)</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="# Título

## Sección 1

Contenido aquí...

### Subsección

Más contenido..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <Badge variant={selectedDocument.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                    {selectedDocument.status}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Versión</label>
                  <span className="text-sm">v{selectedDocument.version}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vistas</label>
                  <span className="text-sm">{selectedDocument.viewCount}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Creado por</label>
                  <span className="text-sm">{selectedDocument.createdBy}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Actualizado</label>
                  <span className="text-sm">
                    {new Date(selectedDocument.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setCurrentStep(WikiStep.VERSIONS);
                    loadDocumentVersions(selectedDocument.id);
                  }}
                >
                  <History className="w-4 h-4 mr-2" />
                  Ver Versiones
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setCurrentStep(WikiStep.PERMISSIONS)}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Gestionar Permisos
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleArchiveDocument(selectedDocument.id)}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archivar
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => handleDeleteDocument(selectedDocument.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );

  const renderSearch = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Búsqueda de Documentos</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documentos..."
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>
        </div>
        <Select value={searchCategory} onValueChange={(v) => setSearchCategory(v || '')}>
          <SelectTrigger>
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSearch} className="w-full">
        <Search className="w-4 h-4 mr-2" />
        Buscar
      </Button>

      {searchResults.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{searchResults.length} resultados encontrados</p>
          {searchResults.map((result) => (
            <Card key={result.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{result.title}</CardTitle>
                  <Badge className="ml-2">{result.category.replace(/_/g, ' ')}</Badge>
                </div>
                <CardDescription>{result.excerpt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {result.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <span className="font-medium">Puntuación:</span>
                    <span>{result.score.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : searchQuery ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600">No se encontraron resultados</p>
            <p className="text-sm text-gray-500">Intenta con otros términos de búsqueda</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  const renderVersions = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Historial de Versiones</h3>
        {selectedDocument && (
          <Button onClick={() => loadDocumentVersions(selectedDocument.id)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        )}
      </div>

      {selectedDocument ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{selectedDocument.title}</CardTitle>
              <CardDescription>Versión actual: v{selectedDocument.version}</CardDescription>
            </CardHeader>
          </Card>

          {documentVersions.length > 0 ? (
            <div className="space-y-3">
              {documentVersions.map((version) => (
                <Card key={version.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">v{version.version}</Badge>
                        <div>
                          <p className="font-medium">{version.changeNote}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(version.createdAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-500">por {version.createdBy}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreVersion(version.id)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Restaurar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-600">No hay versiones anteriores</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600">Selecciona un documento para ver sus versiones</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderPermissions = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Gestión de Permisos</h3>

      {selectedDocument ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedDocument.title}</CardTitle>
              <CardDescription>Configura quién puede acceder a este documento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3">Permisos Actuales</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Administradores</span>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="default">VIEW</Badge>
                      <Badge variant="default">EDIT</Badge>
                      <Badge variant="default">DELETE</Badge>
                      <Badge variant="default">MANAGE</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Usuarios</span>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">VIEW</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Agregar Usuario</h4>
                <div className="space-y-2">
                  <Input placeholder="Buscar usuario..." />
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user1">usuario1@ejemplo.com</SelectItem>
                      <SelectItem value="user2">usuario2@ejemplo.com</SelectItem>
                      <SelectItem value="user3">usuario3@ejemplo.com</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm">VIEW</Button>
                    <Button size="sm" variant="outline">EDIT</Button>
                    <Button size="sm" variant="outline">DELETE</Button>
                    <Button size="sm" variant="outline">MANAGE</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={() => {}} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar Permisos
            </Button>
            <Button onClick={() => {}} variant="outline">
              <Shield className="w-4 h-4 mr-2" />
              Configurar por Rol
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600">Selecciona un documento para gestionar sus permisos</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Wiki de Procedimientos</h1>
          <p className="text-gray-600">Sistema de conocimiento interno</p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            {renderStepIndicator()}
          </CardContent>
        </Card>

        <div className="mb-6">
          <h2 className="text-xl font-semibold">
            {wikiSteps.find((s) => s.id === currentStep)?.label}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div>
            {currentStep === WikiStep.DOCUMENTS && renderDocuments()}
            {currentStep === WikiStep.EDITOR && renderEditor()}
            {currentStep === WikiStep.SEARCH && renderSearch()}
            {currentStep === WikiStep.VERSIONS && renderVersions()}
            {currentStep === WikiStep.PERMISSIONS && renderPermissions()}
          </div>
        )}
      </div>
    </div>
  );
}