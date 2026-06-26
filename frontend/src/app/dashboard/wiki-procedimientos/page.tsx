'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useConocimiento, type ArticleResponse } from '@/hooks/use-conocimiento';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Plus,
  FileText,
  Edit,
  Clock,
  User,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Tag,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function WikiProcedimientosPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { articles, isLoading, error, refetch, createArticle, updateArticle, isCreating } = useConocimiento();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newArticleTitle, setNewArticleTitle] = useState('');
  const [newArticleContent, setNewArticleContent] = useState('');
  const [newArticleCategory, setNewArticleCategory] = useState('');
  const [newArticleTags, setNewArticleTags] = useState('');

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

  const handleCreateArticle = async () => {
    if (!newArticleTitle.trim() || !newArticleContent.trim()) return;

    try {
      const tags = newArticleTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await createArticle({
        title: newArticleTitle,
        content: newArticleContent,
        category: newArticleCategory || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      setIsCreateModalOpen(false);
      setNewArticleTitle('');
      setNewArticleContent('');
      setNewArticleCategory('');
      setNewArticleTags('');
      refetch();
    } catch (error) {
      console.error('Error creating article:', error);
    }
  };

  const handleUpdateArticle = async (id: string) => {
    if (!newArticleTitle.trim() || !newArticleContent.trim()) return;

    try {
      const tags = newArticleTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await updateArticle({
        id,
        data: {
          title: newArticleTitle,
          content: newArticleContent,
          category: newArticleCategory || undefined,
          tags: tags.length > 0 ? tags : undefined,
        },
      });
      setIsEditMode(false);
      setEditingArticleId('');
      setNewArticleTitle('');
      setNewArticleContent('');
      setNewArticleCategory('');
      setNewArticleTags('');
      refetch();
    } catch (error) {
      console.error('Error updating article:', error);
    }
  };

  const startEditArticle = (article: ArticleResponse) => {
    setEditingArticleId(article.id);
    setNewArticleTitle(article.title);
    setNewArticleContent(article.content);
    setNewArticleCategory(article.category || '');
    setNewArticleTags(article.tags?.join(', ') || '');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClose = () => {
    setIsEditMode(false);
    setEditingArticleId('');
    setNewArticleTitle('');
    setNewArticleContent('');
    setNewArticleCategory('');
    setNewArticleTags('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Base de Conocimiento</h1>
        <p className="text-muted-foreground mt-1">
          Sistema de gestión de procedimientos y documentación
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar artículos..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Artículo
            </Button>
          </div>
        </div>

        {isCreateModalOpen && (
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{isEditMode ? 'Editar Artículo' : 'Crear Nuevo Artículo'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={newArticleTitle}
                  onChange={(e) => setNewArticleTitle(e.target.value)}
                  placeholder="Título del artículo"
                />
              </div>
              <div>
                <Label>Categoría (opcional)</Label>
                <Input
                  value={newArticleCategory}
                  onChange={(e) => setNewArticleCategory(e.target.value)}
                  placeholder="Categoría del artículo"
                />
              </div>
              <div>
                <Label>Contenido</Label>
                <Textarea
                  value={newArticleContent}
                  onChange={(e) => setNewArticleContent(e.target.value)}
                  placeholder="Contenido del artículo"
                  rows={8}
                />
              </div>
              <div>
                <Label>Etiquetas (separadas por comas)</Label>
                <Input
                  value={newArticleTags}
                  onChange={(e) => setNewArticleTags(e.target.value)}
                  placeholder="etiqueta1, etiqueta2, etiqueta3"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleEditClose()} variant="outline">
                  Cancelar
                </Button>
                <Button
                  onClick={() => isEditMode ? handleUpdateArticle(editingArticleId) : handleCreateArticle()}
                  disabled={isCreating}
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isEditMode ? 'Guardar Cambios' : 'Crear Artículo'}
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
              No se pudieron cargar los artículos. Por favor intenta nuevamente.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="grid gap-4">
              {filteredArticles.length === 0 ? (
                <Card className="p-12 flex flex-col items-center justify-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? 'No se encontraron resultados' : 'Sin artículos'}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    {searchQuery
                      ? 'Prueba con otros términos de búsqueda'
                      : 'Crea tu primer artículo para empezar a documentar procedimientos'
                    }
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Primer Artículo
                    </Button>
                  )}
                </Card>
              ) : (
                filteredArticles.map((article) => (
                  <Card key={article.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{article.title}</h3>
                          {article.category && (
                            <Badge variant="outline">{article.category}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {article.content.substring(0, 150)}...
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                          </div>
                          {article.authorName && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{article.authorName}</span>
                            </div>
                          )}
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4" />
                              <div className="flex gap-1">
                                {article.tags.slice(0, 2).map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {article.tags.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{article.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEditArticle(article)}>
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