# Arquitectura del Sistema Wiki

## Resumen

Sistema de conocimiento interno para documentar procedimientos, estándares y procesos operativos de cocina. Proporciona gestión de documentos con control de versiones, búsqueda avanzada, categorización y permisos granulares.

## Arquitectura del Sistema

### Componentes

```
Wiki System
├── Document Management
│   ├── CRUD operations
│   ├── Markdown support
│   ├── Hierarchical structure
│   └── Status management (Draft, Published, Archived)
├── Version Control
│   ├── Automatic versioning
│   ├── Version history
│   ├── Change tracking
│   └── Restore from version
├── Search Engine
│   ├── Full-text search
│   ├── Category filtering
│   ├── Tag-based filtering
│   └── Relevance scoring
├── Category System
│   ├── Pre-defined categories
│   ├── Custom categories
│   ├── Document counting
│   └── Ordered display
└── Permission System
    ├── Granular permissions (VIEW, EDIT, DELETE, MANAGE)
    ├── User-based permissions
    ├── Role-based permissions
    └── Permission inheritance
```

## Flujo de Gestión de Documentos

```
1. Creación de Documento
   ├── Definir título y contenido
   ├── Seleccionar categoría
   ├── Agregar etiquetas
   ├── Estado inicial: DRAFT
   └── Versión 1 creada automáticamente

2. Edición de Documento
   ├── Modificar contenido
   ├── Actualizar metadatos
   ├── Versión incrementada automáticamente
   ├── Nota de cambio opcional
   └── Historial actualizado

3. Publicación de Documento
   ├── Cambiar estado a PUBLISHED
   ├── Notificar usuarios relevantes
   ├── Versión final marcada
   └── Documento visible en search

4. Archivado de Documento
   ├── Cambiar estado a ARCHIVED
   ├── Mantener histórico
   ├── No visible en search normal
   └── Puede restaurarse

5. Restauración de Documento
   ├── Cambiar estado de ARCHIVED a PUBLISHED/DRAFT
   ├── Recuperar contenido
   ├── Crear nueva versión
   └── Notificar usuarios
```

## Estructura de Datos

### Documento Wiki

```typescript
interface WikiDocument {
  id: string;
  title: string;
  content: string;              // Markdown format
  category: WikiCategory;
  tags: string[];               // Flexible tagging
  status: WikiStatus;           // DRAFT | PUBLISHED | ARCHIVED
  tenantId: string;
  parentId?: string;            // Parent document for hierarchy
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;              // Current version number
  viewCount: number;            // Track views
}
```

### Versión de Documento

```typescript
interface WikiVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  changeNote: string;
  createdBy: string;
  createdAt: Date;
}
```

### Categoría de Documento

```typescript
enum WikiCategory {
  RECIPE_PREPARATION = 'RECIPE_PREPARATION',
  HYGIENE_SAFETY = 'HYGIENE_SAFETY',
  EQUIPMENT_MAINTENANCE = 'EQUIPMENT_MAINTENANCE',
  PROCUREMENT = 'PROCUREMENT',
  STANDARDS = 'STANDARDS',
  TRAINING = 'TRAINING',
  EMERGENCY_PROCEDURES = 'EMERGENCY_PROCEDURES',
  QUALITY_CONTROL = 'QUALITY_CONTROL',
}

interface WikiCategoryEntity {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  order: number;                // Display order
  documentCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Permisos

```typescript
enum WikiPermission {
  VIEW = 'VIEW',                 // Can read document
  EDIT = 'EDIT',                 // Can edit document
  DELETE = 'DELETE',             // Can delete document
  MANAGE = 'MANAGE',             // Full control (includes all above)
}

interface WikiPermissionEntity {
  id: string;
  documentId: string;
  userId: string;
  role: string;                  // User role
  permissions: WikiPermission[];
  createdAt: Date;
}
```

### Historial de Cambios

```typescript
interface WikiChangeHistory {
  id: string;
  documentId: string;
  documentTitle: string;
  version: number;
  changeType: 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'ARCHIVED' | 'RESTORED';
  changedBy: string;
  changedAt: Date;
  changeNote?: string;
  previousVersionId?: string;
}
```

## Control de Versiones

### Creación de Versiones

```typescript
async function createVersion(
  documentId: string,
  content: string,
  version: number,
  changeNote: string,
  userId: string
): Promise<WikiVersionDto> {
  const wikiVersion = this.wikiVersionRepository.create({
    id: uuidv4(),
    documentId,
    version,
    content,
    changeNote,
    createdBy: userId,
  });

  await this.wikiVersionRepository.save(wikiVersion);

  return {
    id: wikiVersion.id,
    documentId: wikiVersion.documentId,
    version: wikiVersion.version,
    content: wikiVersion.content,
    changeNote: wikiVersion.changeNote,
    createdBy: wikiVersion.createdBy,
    createdAt: wikiVersion.createdAt,
  };
}
```

### Restauración desde Versión

```typescript
async function restoreDocumentFromVersion(
  documentId: string,
  versionId: string,
  tenantId: string,
  userId: string
): Promise<WikiDocumentDto> {
  const version = await this.wikiVersionRepository.findOne({
    where: { id: versionId, documentId },
  });

  if (!version) {
    throw new NotFoundException(`Version ${versionId} not found`);
  }

  const document = await this.wikiDocumentRepository.findOne({
    where: { id: documentId, tenantId },
  });

  if (!document) {
    throw new NotFoundException(`Document ${documentId} not found`);
  }

  await this.checkPermissions(documentId, userId, WikiPermission.EDIT);

  // Restore content and increment version
  document.content = version.content;
  document.version += 1;
  document.updatedBy = userId;

  await this.wikiDocumentRepository.save(document);

  // Create new version
  await this.createVersion(
    documentId,
    version.content,
    document.version,
    `Restored from version ${version.version}`,
    userId
  );

  await this.createChangeHistory(
    documentId,
    document.title,
    document.version,
    'RESTORED',
    userId,
    'Restored from previous version'
  );

  return this.mapDocumentToDto(document);
}
```

## Motor de Búsqueda

### Búsqueda con Puntuación de Relevancia

```typescript
async function searchDocuments(
  query: WikiSearchQueryDto,
  tenantId: string,
  userId: string
): Promise<WikiSearchResultDto[]> {
  const queryBuilder = this.wikiDocumentRepository
    .createQueryBuilder('document')
    .where('document.tenantId = :tenantId', { tenantId });

  // Full-text search in title and content
  if (query.query) {
    queryBuilder.andWhere(
      '(document.title ILIKE :query OR document.content ILIKE :query)',
      { query: `%${query.query}%` }
    );
  }

  // Filter by category
  if (query.category) {
    queryBuilder.andWhere('document.category = :category', { category: query.category });
  }

  // Filter by tags
  if (query.tags && query.tags.length > 0) {
    queryBuilder.andWhere('document.tags && :tags', { tags: query.tags });
  }

  // Filter by status (exclude archived by default)
  if (query.status) {
    queryBuilder.andWhere('document.status = :status', { status: query.status });
  } else {
    queryBuilder.andWhere('document.status != :status', { status: WikiStatus.ARCHIVED });
  }

  const documents = await queryBuilder.getMany();

  // Filter by permissions
  const accessibleDocuments = await this.filterByPermissions(documents, userId, WikiPermission.VIEW);

  // Calculate relevance scores
  const results: WikiSearchResultDto[] = accessibleDocuments.map((doc) => {
    const titleScore = this.calculateRelevanceScore(query.query, doc.title, 3);
    const contentScore = this.calculateRelevanceScore(query.query, doc.content, 1);
    const totalScore = titleScore + contentScore;

    return {
      id: doc.id,
      title: doc.title,
      excerpt: this.generateExcerpt(doc.content, query.query),
      category: doc.category,
      tags: doc.tags,
      score: totalScore,
    };
  });

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}
```

### Cálculo de Puntuación de Relevancia

```typescript
function calculateRelevanceScore(query: string, text: string, weight: number): number {
  if (!query || !text) return 0;

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match in title - highest score
  if (text.toLowerCase() === query.toLowerCase()) {
    return 10 * weight;
  }

  // Contains query - count occurrences
  const matches = (lowerText.match(new RegExp(lowerQuery, 'g')) || []).length;
  return matches * weight;
}
```

### Generación de Extractos

```typescript
function generateExcerpt(content: string, query: string, maxLength: number = 200): string {
  if (!query) {
    return content.substring(0, maxLength) + '...';
  }

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    return content.substring(0, maxLength) + '...';
  }

  // Show context around the match
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + query.length + 50);

  return (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
}
```

## Sistema de Permisos

### Verificación de Permisos

```typescript
async function checkPermissions(
  documentId: string,
  userId: string,
  requiredPermission: WikiPermission
): Promise<boolean> {
  const permissions = await this.wikiPermissionRepository.find({
    where: { documentId, userId },
  });

  if (permissions.length === 0) {
    // No specific permissions, check default
    return this.checkDefaultPermissions(userId, requiredPermission);
  }

  const userPermissions = permissions.flatMap((p) => p.permissions);

  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  if (userPermissions.includes(WikiPermission.MANAGE)) {
    return true; // MANAGE grants all permissions
  }

  throw new ForbiddenException(`User does not have ${requiredPermission} permission`);
}
```

### Permisos por Defecto

```typescript
function checkDefaultPermissions(userId: string, requiredPermission: WikiPermission): boolean {
  // Default: ADMIN has all permissions, USER has VIEW only
  // This would typically check user roles from a separate service
  return requiredPermission === WikiPermission.VIEW;
}
```

### Filtrado por Permisos

```typescript
async function filterByPermissions(
  documents: any[],
  userId: string,
  requiredPermission: WikiPermission
): Promise<any[]> {
  const accessible: any[] = [];

  for (const doc of documents) {
    try {
      await this.checkPermissions(doc.id, userId, requiredPermission);
      accessible.push(doc);
    } catch (error) {
      // Skip documents user doesn't have permission for
    }
  }

  return accessible;
}
```

## Gestión de Categorías

### Creación de Categorías

```typescript
async function createCategory(dto: CreateWikiCategoryDto, userId: string): Promise<WikiCategoryDto> {
  const category = this.wikiCategoryRepository.create({
    id: uuidv4(),
    ...dto,
    documentCount: 0,
    createdBy: userId,
  });

  await this.wikiCategoryRepository.save(category);

  return {
    id: category.id,
    name: category.name,
    description: category.description,
    tenantId: category.tenantId,
    order: category.order,
    documentCount: category.documentCount,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
```

### Actualización de Contador de Documentos

```typescript
async function updateCategoryDocumentCount(categoryId: string): Promise<void> {
  const count = await this.wikiDocumentRepository.count({
    where: { categoryId },
  });

  await this.wikiCategoryRepository.update(categoryId, { documentCount: count });
}
```

## Historial de Cambios

### Registro de Cambios

```typescript
async function createChangeHistory(
  documentId: string,
  documentTitle: string,
  version: number,
  changeType: string,
  userId: string,
  changeNote?: string
): Promise<void> {
  const history = this.wikiChangeHistoryRepository.create({
    id: uuidv4(),
    documentId,
    documentTitle,
    version,
    changeType,
    changedBy: userId,
    changeNote,
  });

  await this.wikiChangeHistoryRepository.save(history);
}
```

### Determinación de Tipo de Cambio

```typescript
function determineChangeType(oldStatus: WikiStatus, newStatus?: WikiStatus): string {
  if (newStatus === WikiStatus.PUBLISHED && oldStatus !== WikiStatus.PUBLISHED) {
    return 'PUBLISHED';
  }
  if (newStatus === WikiStatus.ARCHIVED) {
    return 'ARCHIVED';
  }
  if (newStatus && newStatus !== oldStatus) {
    return 'STATUS_CHANGE';
  }
  return 'UPDATED';
}
```

## API Reference

### Crear Documento

```http
POST /api/v1/wiki/documents
Authorization: Bearer {token}

{
  "title": "Procedimiento de limpieza de cocina",
  "content": "# Limpieza de Cocina\n\n## Paso 1: ...",
  "category": "HYGIENE_SAFETY",
  "tags": ["limpieza", "cocina", "procedimiento"],
  "tenantId": "uuid-tenant-id",
  "userId": "uuid-user-id"
}

Response 201:
{
  "id": "uuid",
  "title": "Procedimiento de limpieza de cocina",
  "content": "# Limpieza de Cocina...",
  "category": "HYGIENE_SAFETY",
  "tags": ["limpieza", "cocina", "procedimiento"],
  "status": "DRAFT",
  "tenantId": "uuid-tenant-id",
  "createdBy": "uuid-user-id",
  "createdAt": "2026-05-31T14:00:00Z",
  "updatedAt": "2026-05-31T14:00:00Z",
  "version": 1,
  "viewCount": 0
}
```

### Buscar Documentos

```http
POST /api/v1/wiki/search
Authorization: Bearer {token}

{
  "query": "limpieza",
  "category": "HYGIENE_SAFETY",
  "tags": ["cocina"],
  "status": "PUBLISHED"
}

Response 200:
[
  {
    "id": "uuid",
    "title": "Procedimiento de limpieza de cocina",
    "excerpt": "# Limpieza de Cocina\n\nEste procedimiento describe...",
    "category": "HYGIENE_SAFETY",
    "tags": ["limpieza", "cocina", "procedimiento"],
    "score": 9.5
  }
]
```

### Obtener Versiones de Documento

```http
GET /api/v1/wiki/documents/{id}/versions
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "uuid",
    "documentId": "uuid",
    "version": 3,
    "content": "# Limpieza de Cocina...",
    "changeNote": "Added step about sanitizing tools",
    "createdBy": "uuid-user-id",
    "createdAt": "2026-05-31T14:30:00Z"
  }
]
```

### Restaurar desde Versión

```http
PUT /api/v1/wiki/documents/{documentId}/restore/{versionId}
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "title": "Procedimiento de limpieza de cocina",
  "content": "# Limpieza de Cocina...",
  "category": "HYGIENE_SAFETY",
  "tags": ["limpieza", "cocina", "procedimiento"],
  "status": "PUBLISHED",
  "tenantId": "uuid-tenant-id",
  "createdBy": "uuid-user-id",
  "createdAt": "2026-05-31T14:00:00Z",
  "updatedAt": "2026-05-31T14:35:00Z",
  "version": 4,
  "viewCount": 25
}
```

## Checklist de Implementación

### Gestión de Documentos ✅
- [x] CRUD operations
- [x] Markdown support
- [x] Hierarchical structure
- [x] Status management (Draft, Published, Archived)
- [x] View tracking

### Control de Versiones ✅
- [x] Automatic versioning
- [x] Version history
- [x] Change tracking
- [x] Restore from version
- [x] Change notes

### Sistema de Búsqueda ✅
- [x] Full-text search
- [x] Category filtering
- [x] Tag-based filtering
- [x] Relevance scoring
- [x] Excerpt generation

### Categorías ✅
- [x] Pre-defined categories
- [x] Custom categories
- [x] Document counting
- [x] Ordered display
- [x] 8 categories definidas

### Permisos ✅
- [x] 4 tipos de permisos
- [x] User-based permissions
- [x] Role-based permissions
- [x] Permission checking
- [x] Granular control

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 15 - Wiki de Procedimientos