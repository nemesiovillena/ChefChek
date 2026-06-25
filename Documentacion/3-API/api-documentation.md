# Documentación de API - ChefChek

**Versión:** 0.1.0  
**Fecha:** Junio 2026  
**Base URL:** `http://localhost:3001/api`  
**Documentación Interactiva:** `http://localhost:3001/api/docs`

## Tabla de Contenidos

1. [Autenticación y Flujo de Tokens](#1-autenticación-y-flujo-de-tokens)
2. [Ejemplos de Endpoints Principales](#2-ejemplos-de-endpoints-principales)
3. [Integración con APIs](#3-integración-con-apis)
4. [Códigos de Error y Respuestas](#4-códigos-de-error-y-respuestas)
5. [Swagger UI](#5-swagger-ui)

---

## 1. Autenticación y Flujo de Tokens

ChefChek utiliza autenticación basada en JWT (JSON Web Tokens) con soporte multi-tenant. Cada request debe incluir el token JWT y el identificador del tenant.

### 1.1 Flujo de Autenticación

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ Cliente │                │  API    │                │   DB    │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ POST /api/v1/auth/login  │                          │
     │─────────────────────────>│                          │
     │ {email, password,        │                          │
     │  tenantId}               │                          │
     │                          │                          │
     │                          │ Validar credenciales     │
     │                          │─────────────────────────>│
     │                          │                          │
     │                          │ Usuario válido           │
     │                          │<─────────────────────────│
     │                          │                          │
     │ 200 OK                   │                          │
     │<─────────────────────────│                          │
     │ {accessToken, sessionId, │                          │
     │  user: {...}}             │                          │
     │                          │                          │
     │ POST /api/v1/products    │                          │
     │ Header: Authorization:   │                          │
     │ Bearer {accessToken}     │                          │
     │ Header: X-Tenant-Id:     │                          │
     │ {tenantId}               │                          │
     │─────────────────────────>│                          │
     │                          │ Validar token + tenant    │
     │                          │─────────────────────────>│
     │                          │                          │
     │                          │ Datos del producto        │
     │                          │<─────────────────────────│
     │                          │                          │
     │ 200 OK {products}        │                          │
     │<─────────────────────────│                          │
     │                          │                          │
     │ POST /api/v1/auth/refresh│                          │
     │ {sessionId}              │                          │
     │─────────────────────────>│                          │
     │                          │                          │
     │ 200 OK {newAccessToken}  │                          │
     │<─────────────────────────│                          │
     │                          │                          │
     │ DELETE /api/v1/auth/logout│                          │
     │ {sessionId}              │                          │
     │─────────────────────────>│                          │
     │                          │ Invalidar sesión         │
     │                          │─────────────────────────>│
     │ 204 No Content           │                          │
     │<─────────────────────────│                          │
```

### 1.2 Login

Inicia sesión y obtiene un token JWT de acceso.

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "tenantId": "tenant-uuid-123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "sessionId": "sess-uuid-456",
    "user": {
      "id": "user-uuid-789",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez",
      "role": "ADMIN"
    }
  },
  "message": "Login successful"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@ejemplo.com",
    "password": "contraseña123",
    "tenantId": "tenant-uuid-123"
  }'
```

**Ejemplo JavaScript (fetch):**
```javascript
const login = async () => {
  const response = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'usuario@ejemplo.com',
      password: 'contraseña123',
      tenantId: 'tenant-uuid-123'
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Guardar token para requests futuros
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('sessionId', data.data.sessionId);
    localStorage.setItem('tenantId', 'tenant-uuid-123');
    console.log('Usuario:', data.data.user);
  }
  
  return data;
};
```

### 1.3 Refresh Token

Refresca el token JWT sin requerir credenciales nuevamente.

**Endpoint:** `POST /api/v1/auth/refresh`

**Request Body:**
```json
{
  "sessionId": "sess-uuid-456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "sessionId": "sess-uuid-456"
  },
  "message": "Token refreshed successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "sess-uuid-456"}'
```

**Ejemplo JavaScript:**
```javascript
const refreshToken = async (sessionId) => {
  const response = await fetch('http://localhost:3001/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('accessToken', data.data.accessToken);
  }
  
  return data;
};
```

### 1.4 Logout

Cierra la sesión e invalida el token.

**Endpoint:** `POST /api/v1/auth/logout`

**Request Body:**
```json
{
  "sessionId": "sess-uuid-456"
}
```

**Response (204 No Content):**
```
(Sin cuerpo de respuesta)
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "sess-uuid-456"}'
```

**Ejemplo JavaScript:**
```javascript
const logout = async (sessionId) => {
  await fetch('http://localhost:3001/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId })
  });
  
  // Limpiar almacenamiento local
  localStorage.removeItem('accessToken');
  localStorage.removeItem('sessionId');
  localStorage.removeItem('tenantId');
};
```

### 1.5 Validar Sesión

Verifica si la sesión actual es válida.

**Endpoint:** `GET /api/v1/auth/validate`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid-789",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez",
      "role": "ADMIN"
    },
    "isValid": true
  },
  "message": "Session is valid"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/auth/validate \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Ejemplo JavaScript:**
```javascript
const validateSession = async () => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3001/api/v1/auth/validate', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### 1.6 Listar Sesiones Activas

Obtiene todas las sesiones activas del usuario actual.

**Endpoint:** `GET /api/v1/auth/sessions`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "sess-uuid-456",
      "device": "Chrome on macOS",
      "ipAddress": "192.168.1.100",
      "createdAt": "2026-06-03T10:30:00Z",
      "lastActive": "2026-06-03T15:45:00Z",
      "isActive": true
    }
  ],
  "message": "Sessions retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/auth/sessions \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const getSessions = async () => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch('http://localhost:3001/api/v1/auth/sessions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};
```

### 1.7 Invalidar Sesión Específica

Invalida una sesión específica del usuario.

**Endpoint:** `DELETE /api/v1/auth/sessions/:sessionId`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session invalidated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X DELETE http://localhost:3001/api/v1/auth/sessions/sess-uuid-456 \
  -H "Authorization: Bearer {token}"
```

**Ejemplo JavaScript:**
```javascript
const invalidateSession = async (sessionId) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:3001/api/v1/auth/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### 1.8 Invalidar Todas las Sesiones

Invalida todas las sesiones del usuario actual.

**Endpoint:** `DELETE /api/v1/auth/sessions`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "All sessions invalidated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X DELETE http://localhost:3001/api/v1/auth/sessions \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const invalidateAllSessions = async () => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch('http://localhost:3001/api/v1/auth/sessions', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};
```

### 1.9 Formato del Token Bearer

El token JWT debe enviarse en el header `Authorization` con el formato `Bearer {token}`:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### 1.10 Multi-Tenant: Header X-Tenant-Id

Cada request autenticado debe incluir el header `X-Tenant-Id` para identificar el tenant del contexto:

```
X-Tenant-Id: tenant-uuid-123
```

**Ejemplo de request completo:**
```bash
curl -X GET http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

---

## 2. Ejemplos de Endpoints Principales

### 2.1 Products (Productos)

Gestión completa de productos e ingredientes con soporte multi-unidad y alérgenos.

#### 2.1.1 Crear Producto

**Endpoint:** `POST /api/v1/products`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Request Body:**
```json
{
  "name": "Tomates frescos",
  "description": "Tomates rojos maduros de calidad premium",
  "category": "Verduras",
  "supplier": "Proveedora Local S.L.",
  "purchaseUnit": "Caja 10kg",
  "storageUnit": "Kilogramos",
  "recipeUnit": "Gramos",
  "purchasePrice": 25.50,
  "netPrice": 23.50,
  "profitMargin": 15,
  "wastePercentage": 10,
  "yieldFactor": 0.9,
  "allergens": []
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid-123",
    "name": "Tomates frescos",
    "description": "Tomates rojos maduros de calidad premium",
    "category": "Verduras",
    "supplier": "Proveedora Local S.L.",
    "purchaseUnit": "Caja 10kg",
    "storageUnit": "Kilogramos",
    "recipeUnit": "Gramos",
    "purchasePrice": 25.50,
    "netPrice": 23.50,
    "profitMargin": 15,
    "wastePercentage": 10,
    "yieldFactor": 0.9,
    "allergens": [],
    "isActive": true,
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "Product created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tomates frescos",
    "description": "Tomates rojos maduros de calidad premium",
    "category": "Verduras",
    "supplier": "Proveedora Local S.L.",
    "purchaseUnit": "Caja 10kg",
    "storageUnit": "Kilogramos",
    "recipeUnit": "Gramos",
    "purchasePrice": 25.50,
    "netPrice": 23.50,
    "profitMargin": 15,
    "wastePercentage": 10,
    "yieldFactor": 0.9,
    "allergens": []
  }'
```

**Ejemplo JavaScript:**
```javascript
const createProduct = async () => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch('http://localhost:3001/api/v1/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Tomates frescos',
      description: 'Tomates rojos maduros de calidad premium',
      category: 'Verduras',
      supplier: 'Proveedora Local S.L.',
      purchaseUnit: 'Caja 10kg',
      storageUnit: 'Kilogramos',
      recipeUnit: 'Gramos',
      purchasePrice: 25.50,
      netPrice: 23.50,
      profitMargin: 15,
      wastePercentage: 10,
      yieldFactor: 0.9,
      allergens: []
    })
  });
  
  return await response.json();
};
```

#### 2.1.2 Listar Productos

**Endpoint:** `GET /api/v1/products`

**Query Parameters:**
- `search` (string, opcional): Buscar por nombre
- `category` (string, opcional): Filtrar por categoría
- `supplier` (string, opcional): Filtrar por proveedor
- `isActive` (boolean, opcional): Filtrar por estado activo
- `sortBy` (string, opcional): Campo de ordenación
- `sortOrder` (string, opcional): 'asc' o 'desc'
- `page` (number, opcional): Número de página
- `limit` (number, opcional): Resultados por página

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod-uuid-123",
      "name": "Tomates frescos",
      "category": "Verduras",
      "supplier": "Proveedora Local S.L.",
      "purchaseUnit": "Caja 10kg",
      "storageUnit": "Kilogramos",
      "recipeUnit": "Gramos",
      "purchasePrice": 25.50,
      "isActive": true
    }
  ],
  "message": "Products retrieved successfully",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Ejemplo cURL:**
```bash
# Listar todos los productos
curl -X GET "http://localhost:3001/api/v1/products" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"

# Filtrar por categoría con paginación
curl -X GET "http://localhost:3001/api/v1/products?category=Verduras&page=1&limit=10" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"

# Buscar por nombre
curl -X GET "http://localhost:3001/api/v1/products?search=tomates" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const getProducts = async (filters = {}) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const params = new URLSearchParams(filters);
  const response = await fetch(`http://localhost:3001/api/v1/products?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};

// Ejemplos de uso:
const allProducts = await getProducts();
const verduras = await getProducts({ category: 'Verduras', page: 1, limit: 10 });
const searchResults = await getProducts({ search: 'tomates' });
```

#### 2.1.3 Obtener Producto por ID

**Endpoint:** `GET /api/v1/products/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid-123",
    "name": "Tomates frescos",
    "description": "Tomates rojos maduros de calidad premium",
    "category": "Verduras",
    "supplier": "Proveedora Local S.L.",
    "purchaseUnit": "Caja 10kg",
    "storageUnit": "Kilogramos",
    "recipeUnit": "Gramos",
    "purchasePrice": 25.50,
    "netPrice": 23.50,
    "profitMargin": 15,
    "wastePercentage": 10,
    "yieldFactor": 0.9,
    "allergens": [],
    "isActive": true,
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "Product retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/products/prod-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const getProduct = async (productId) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/products/${productId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};
```

#### 2.1.4 Actualizar Producto

**Endpoint:** `PATCH /api/v1/products/:id`

**Request Body (parcial):**
```json
{
  "name": "Tomates frescos ecológicos",
  "purchasePrice": 28.00,
  "wastePercentage": 8
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid-123",
    "name": "Tomates frescos ecológicos",
    "purchasePrice": 28.00,
    "wastePercentage": 8,
    "updatedAt": "2026-06-03T11:00:00Z"
  },
  "message": "Product updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PATCH http://localhost:3001/api/v1/products/prod-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tomates frescos ecológicos",
    "purchasePrice": 28.00,
    "wastePercentage": 8
  }'
```

**Ejemplo JavaScript:**
```javascript
const updateProduct = async (productId, updates) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/products/${productId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return await response.json();
};
```

#### 2.1.5 Eliminar Producto

**Endpoint:** `DELETE /api/v1/products/:id`

**Response (204 No Content):**
```
(Sin cuerpo de respuesta)
```

**Ejemplo cURL:**
```bash
curl -X DELETE http://localhost:3001/api/v1/products/prod-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const deleteProduct = async (productId) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/products/${productId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return response.status === 204;
};
```

#### 2.1.6 Obtener Categorías

**Endpoint:** `GET /api/v1/products/categories`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    "Verduras",
    "Frutas",
    "Carnes",
    "Pescados",
    "Lácteos",
    "Panadería",
    "Bebidas"
  ],
  "message": "Categories retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/products/categories \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### 2.1.7 Obtener Proveedores

**Endpoint:** `GET /api/v1/products/suppliers`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "supp-uuid-123",
      "name": "Proveedora Local S.L.",
      "email": "contacto@proveedora.com",
      "phone": "+34 900 123 456"
    }
  ],
  "message": "Suppliers retrieved successfully"
}
```

#### 2.1.8 Calcular Costo de Producto

**Endpoint:** `GET /api/v1/products/:id/calculate`

Calcula el costo real del producto considerando mermas y rendimientos.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": "prod-uuid-123",
    "productName": "Tomates frescos",
    "purchasePrice": 25.50,
    "wastePercentage": 10,
    "yieldFactor": 0.9,
    "realCostPerUnit": 0.0315,
    "realCostPerKg": 31.50,
    "breakdown": {
      "baseCost": 25.50,
      "wasteCost": 2.55,
      "yieldAdjustment": 3.45
    }
  },
  "message": "Product cost calculated successfully"
}
```

---

### 2.2 Recipes (Recetas/Escandallos)

Gestión de recetas con ingredientes, sub-recetas, y cálculo de costos completo.

#### 2.2.1 Crear Receta

**Endpoint:** `POST /api/v1/recipes`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Request Body:**
```json
{
  "name": "Salsa de tomate casera",
  "description": "Salsa de tomate tradicional con albahaca",
  "elaboration": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Picar los tomates y sofreír con aceite de oliva.\"}]}]}",
  "portions": 10,
  "portionSize": 100,
  "ingredients": [
    {
      "productId": "prod-uuid-123",
      "quantity": 2000,
      "unit": "Gramos"
    },
    {
      "productId": "prod-uuid-456",
      "quantity": 100,
      "unit": "Mililitros"
    }
  ],
  "subRecipes": [],
  "isPublic": true
}
```

**Nota:** El campo `elaboration` usa formato TipTap JSON (editor de texto enriquecido).

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "recipe-uuid-123",
    "name": "Salsa de tomate casera",
    "description": "Salsa de tomate tradicional con albahaca",
    "elaboration": "{\"type\":\"doc\",...}",
    "portions": 10,
    "portionSize": 100,
    "ingredients": [
      {
        "id": "ing-uuid-789",
        "productId": "prod-uuid-123",
        "productName": "Tomates frescos",
        "quantity": 2000,
        "unit": "Gramos"
      }
    ],
    "subRecipes": [],
    "isPublic": true,
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "Recipe created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/recipes \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Salsa de tomate casera",
    "description": "Salsa de tomate tradicional con albahaca",
    "elaboration": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Picar los tomates y sofreír con aceite de oliva.\"}]}]}",
    "portions": 10,
    "portionSize": 100,
    "ingredients": [
      {
        "productId": "prod-uuid-123",
        "quantity": 2000,
        "unit": "Gramos"
      },
      {
        "productId": "prod-uuid-456",
        "quantity": 100,
        "unit": "Mililitros"
      }
    ],
    "subRecipes": [],
    "isPublic": true
  }'
```

**Ejemplo JavaScript:**
```javascript
const createRecipe = async () => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const elaborationContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Picar los tomates y sofreír con aceite de oliva.'
          }
        ]
      }
    ]
  };
  
  const response = await fetch('http://localhost:3001/api/v1/recipes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Salsa de tomate casera',
      description: 'Salsa de tomate tradicional con albahaca',
      elaboration: JSON.stringify(elaborationContent),
      portions: 10,
      portionSize: 100,
      ingredients: [
        {
          productId: 'prod-uuid-123',
          quantity: 2000,
          unit: 'Gramos'
        },
        {
          productId: 'prod-uuid-456',
          quantity: 100,
          unit: 'Mililitros'
        }
      ],
      subRecipes: [],
      isPublic: true
    })
  });
  
  return await response.json();
};
```

#### 2.2.2 Listar Recetas

**Endpoint:** `GET /api/v1/recipes`

**Query Parameters:**
- `search` (string, opcional): Buscar por nombre
- `category` (string, opcional): Filtrar por categoría

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "recipe-uuid-123",
      "name": "Salsa de tomate casera",
      "description": "Salsa de tomate tradicional con albahaca",
      "portions": 10,
      "portionSize": 100,
      "isPublic": true,
      "createdAt": "2026-06-03T10:30:00Z"
    }
  ],
  "message": "Recipes retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
# Listar todas las recetas
curl -X GET "http://localhost:3001/api/v1/recipes" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"

# Buscar recetas
curl -X GET "http://localhost:3001/api/v1/recipes?search=salsa" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const getRecipes = async (filters = {}) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const params = new URLSearchParams(filters);
  const response = await fetch(`http://localhost:3001/api/v1/recipes?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};
```

#### 2.2.3 Obtener Receta por ID

**Endpoint:** `GET /api/v1/recipes/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "recipe-uuid-123",
    "name": "Salsa de tomate casera",
    "description": "Salsa de tomate tradicional con albahaca",
    "elaboration": "{\"type\":\"doc\",...}",
    "portions": 10,
    "portionSize": 100,
    "ingredients": [
      {
        "id": "ing-uuid-789",
        "productId": "prod-uuid-123",
        "productName": "Tomates frescos",
        "quantity": 2000,
        "unit": "Gramos",
        "cost": 63.00
      }
    ],
    "subRecipes": [],
    "totalCost": 68.50,
    "costPerPortion": 6.85,
    "isPublic": true,
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "Recipe retrieved successfully"
}
```

#### 2.2.4 Actualizar Receta

**Endpoint:** `PATCH /api/v1/recipes/:id`

**Request Body (parcial):**
```json
{
  "name": "Salsa de tomate casera v2",
  "portions": 12,
  "ingredients": [
    {
      "productId": "prod-uuid-123",
      "quantity": 2400,
      "unit": "Gramos"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "recipe-uuid-123",
    "name": "Salsa de tomate casera v2",
    "portions": 12,
    "updatedAt": "2026-06-03T11:00:00Z"
  },
  "message": "Recipe updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PATCH http://localhost:3001/api/v1/recipes/recipe-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Salsa de tomate casera v2",
    "portions": 12
  }'
```

**Ejemplo JavaScript:**
```javascript
const updateRecipe = async (recipeId, updates) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/recipes/${recipeId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return await response.json();
};
```

#### 2.2.5 Duplicar Receta

**Endpoint:** `POST /api/v1/recipes/:id/duplicate`

**Request Body:**
```json
{
  "newName": "Salsa de tomate casera (copia)"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "recipe-uuid-456",
    "name": "Salsa de tomate casera (copia)",
    "description": "Salsa de tomate tradicional con albahaca",
    "portions": 10,
    "ingredients": [
      {
        "productId": "prod-uuid-123",
        "quantity": 2000,
        "unit": "Gramos"
      }
    ],
    "totalCost": 68.50,
    "costPerPortion": 6.85,
    "createdAt": "2026-06-03T11:30:00Z"
  },
  "message": "Recipe duplicated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/recipes/recipe-uuid-123/duplicate \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{"newName": "Salsa de tomate casera (copia)"}'
```

**Ejemplo JavaScript:**
```javascript
const duplicateRecipe = async (recipeId, newName) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/recipes/${recipeId}/duplicate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newName })
  });
  
  return await response.json();
};
```

#### 2.2.6 Calcular Costo de Receta

**Endpoint:** `GET /api/v1/recipes/:id/calculate`

Calcula el costo completo del escandallo con mermas consideradas.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "recipeId": "recipe-uuid-123",
    "recipeName": "Salsa de tomate casera",
    "portions": 10,
    "totalCost": 68.50,
    "costPerPortion": 6.85,
    "costPerKg": 68.50,
    "breakdown": {
      "ingredients": [
        {
          "productId": "prod-uuid-123",
          "productName": "Tomates frescos",
          "quantity": 2000,
          "unit": "Gramos",
          "baseCost": 63.00,
          "wasteCost": 6.30,
          "realCost": 69.30
        }
      ],
      "subRecipes": [],
      "totalBaseCost": 68.50,
      "totalWasteCost": 6.93,
      "totalRealCost": 75.43
    }
  },
  "message": "Recipe cost calculated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/recipes/recipe-uuid-123/calculate \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### 2.2.7 Eliminar Receta

**Endpoint:** `DELETE /api/v1/recipes/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Recipe deleted successfully"
}
```

---

### 2.3 Menus (Menús/Cartas)

Gestión de menús y cartas con secciones, items y traducciones.

#### 2.3.1 Crear Menú

**Endpoint:** `POST /api/v1/menus`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Request Body:**
```json
{
  "name": "Menú del Día",
  "description": "Menú especial del fin de semana",
  "startDate": "2026-06-07T00:00:00Z",
  "endDate": "2026-06-09T23:59:59Z",
  "portions": 50,
  "sections": [
    {
      "name": "Entrantes",
      "order": 1,
      "items": [
        {
          "recipeId": "recipe-uuid-123",
          "price": 8.50,
          "isAvailable": true
        },
        {
          "recipeId": "recipe-uuid-456",
          "price": 9.00,
          "isAvailable": true
        }
      ]
    },
    {
      "name": "Principales",
      "order": 2,
      "items": [
        {
          "recipeId": "recipe-uuid-789",
          "price": 15.50,
          "isAvailable": true
        }
      ]
    }
  ],
  "translations": [
    {
      "language": "en",
      "name": "Weekend Menu",
      "description": "Special weekend menu",
      "sectionsTranslations": {
        "Entrantes": "Starters",
        "Principales": "Mains"
      }
    }
  ],
  "isActive": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "menu-uuid-123",
    "name": "Menú del Día",
    "description": "Menú especial del fin de semana",
    "startDate": "2026-06-07T00:00:00Z",
    "endDate": "2026-06-09T23:59:59Z",
    "portions": 50,
    "sections": [
      {
        "id": "section-uuid-123",
        "name": "Entrantes",
        "order": 1,
        "items": [
          {
            "id": "item-uuid-123",
            "recipeId": "recipe-uuid-123",
            "recipeName": "Ensalada mediterránea",
            "price": 8.50,
            "isAvailable": true
          }
        ]
      }
    ],
    "translations": [
      {
        "language": "en",
        "name": "Weekend Menu",
        "description": "Special weekend menu",
        "sectionsTranslations": {
          "Entrantes": "Starters",
          "Principales": "Mains"
        }
      }
    ],
    "isActive": true,
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "Menu created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/menus \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Menú del Día",
    "description": "Menú especial del fin de semana",
    "startDate": "2026-06-07T00:00:00Z",
    "endDate": "2026-06-09T23:59:59Z",
    "portions": 50,
    "sections": [
      {
        "name": "Entrantes",
        "order": 1,
        "items": [
          {
            "recipeId": "recipe-uuid-123",
            "price": 8.50,
            "isAvailable": true
          }
        ]
      }
    ],
    "isActive": true
  }'
```

**Ejemplo JavaScript:**
```javascript
const createMenu = async () => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch('http://localhost:3001/api/v1/menus', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Menú del Día',
      description: 'Menú especial del fin de semana',
      startDate: '2026-06-07T00:00:00Z',
      endDate: '2026-06-09T23:59:59Z',
      portions: 50,
      sections: [
        {
          name: 'Entrantes',
          order: 1,
          items: [
            {
              recipeId: 'recipe-uuid-123',
              price: 8.50,
              isAvailable: true
            }
          ]
        }
      ],
      isActive: true
    })
  });
  
  return await response.json();
};
```

#### 2.3.2 Listar Menús

**Endpoint:** `GET /api/v1/menus`

**Query Parameters:**
- `search` (string, opcional): Buscar por nombre
- `isActive` (boolean, opcional): Filtrar por estado activo

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "menu-uuid-123",
      "name": "Menú del Día",
      "description": "Menú especial del fin de semana",
      "startDate": "2026-06-07T00:00:00Z",
      "endDate": "2026-06-09T23:59:59Z",
      "portions": 50,
      "isActive": true,
      "createdAt": "2026-06-03T10:30:00Z"
    }
  ],
  "message": "Menus retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
# Listar todos los menús
curl -X GET "http://localhost:3001/api/v1/menus" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"

# Filtrar menús activos
curl -X GET "http://localhost:3001/api/v1/menus?isActive=true" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const getMenus = async (filters = {}) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const params = new URLSearchParams(filters);
  const response = await fetch(`http://localhost:3001/api/v1/menus?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};
```

#### 2.3.3 Obtener Menú por ID

**Endpoint:** `GET /api/v1/menus/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "menu-uuid-123",
    "name": "Menú del Día",
    "description": "Menú especial del fin de semana",
    "startDate": "2026-06-07T00:00:00Z",
    "endDate": "2026-06-09T23:59:59Z",
    "portions": 50,
    "sections": [
      {
        "id": "section-uuid-123",
        "name": "Entrantes",
        "order": 1,
        "items": [
          {
            "id": "item-uuid-123",
            "recipeId": "recipe-uuid-123",
            "recipeName": "Ensalada mediterránea",
            "price": 8.50,
            "isAvailable": true
          }
        ]
      }
    ],
    "translations": [],
    "isActive": true,
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "Menu retrieved successfully"
}
```

#### 2.3.4 Actualizar Menú

**Endpoint:** `PATCH /api/v1/menus/:id`

**Request Body (parcial):**
```json
{
  "name": "Menú del Fin de Semana",
  "portions": 60
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "menu-uuid-123",
    "name": "Menú del Fin de Semana",
    "portions": 60,
    "updatedAt": "2026-06-03T11:00:00Z"
  },
  "message": "Menu updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PATCH http://localhost:3001/api/v1/menus/menu-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Menú del Fin de Semana",
    "portions": 60
  }'
```

**Ejemplo JavaScript:**
```javascript
const updateMenu = async (menuId, updates) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/menus/${menuId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return await response.json();
};
```

#### 2.3.5 Calcular Costo de Menú

**Endpoint:** `GET /api/v1/menus/:id/calculate`

Calcula el costo total del menú con todas sus recetas.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "menuId": "menu-uuid-123",
    "menuName": "Menú del Día",
    "portions": 50,
    "totalCost": 425.00,
    "costPerPortion": 8.50,
    "totalRevenue": 850.00,
    "profitMargin": 50.0,
    "breakdown": [
      {
        "sectionId": "section-uuid-123",
        "sectionName": "Entrantes",
        "items": [
          {
            "recipeId": "recipe-uuid-123",
            "recipeName": "Ensalada mediterránea",
            "price": 8.50,
            "cost": 4.25,
            "profitMargin": 50.0
          }
        ],
        "sectionCost": 212.50,
        "sectionRevenue": 425.00
      }
    ]
  },
  "message": "Menu cost calculated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/menus/menu-uuid-123/calculate \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### 2.3.6 Generar Código QR

**Endpoint:** `GET /api/v1/menus/:id/qr-code`

Genera un código QR para compartir el menú digitalmente.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "qrCodeUrl": "https://chefchek.com/m/menu-uuid-123",
    "qrCodeImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "expiresAt": "2026-06-10T00:00:00Z"
  },
  "message": "QR code generated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/menus/menu-uuid-123/qr-code \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### 2.3.7 Eliminar Menú

**Endpoint:** `DELETE /api/v1/menus/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Menu deleted successfully"
}
```

---

### 2.4 Orders (Pedidos)

Sistema de pedidos automatizados con cálculo de requerimientos y clasificación inteligente.

#### 2.4.1 Calcular Requerimientos de Pedido

**Endpoint:** `POST /api/v1/orders/calculate-requirements`

**Request Body:**
```json
{
  "tenantId": "tenant-uuid-123",
  "historicalPeriod": 7,
  "lookaheadDays": 7
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-uuid-123",
    "calculationDate": "2026-06-03T10:00:00Z",
    "requirements": [
      {
        "id": "req-uuid-123",
        "productId": "prod-uuid-123",
        "productName": "Tomates frescos",
        "currentStock": 50,
        "minimumStock": 20,
        "projectedConsumption": 45,
        "requiredQuantity": 15,
        "suggestedQuantity": 20,
        "urgency": "MEDIUM",
        "supplierId": "supp-uuid-123",
        "supplierName": "Proveedora Local S.L.",
        "conservationZone": "Cámara fría",
        "category": "Verduras",
        "unit": "Kilogramos",
        "estimatedCost": 25.50,
        "lastOrderDate": "2026-05-27T00:00:00Z",
        "averageDailyConsumption": 6.43
      }
    ],
    "summary": {
      "totalProducts": 15,
      "urgentProducts": 3,
      "estimatedTotalCost": 450.00
    }
  },
  "message": "Requirements calculated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/orders/calculate-requirements \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-uuid-123",
    "historicalPeriod": 7,
    "lookaheadDays": 7
  }'
```

**Ejemplo JavaScript:**
```javascript
const calculateRequirements = async (tenantId) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3001/api/v1/orders/calculate-requirements', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tenantId,
      historicalPeriod: 7,
      lookaheadDays: 7
    })
  });
  
  return await response.json();
};
```

#### 2.4.2 Generar Pedido Automatizado

**Endpoint:** `POST /api/v1/orders/generate`

**Request Body:**
```json
{
  "tenantId": "tenant-uuid-123",
  "supplierId": "supp-uuid-123",
  "urgency": "MEDIUM",
  "scheduledDelivery": "2026-06-05T10:00:00Z",
  "items": [
    {
      "productId": "prod-uuid-123",
      "requestedQuantity": 20,
      "unitPrice": 25.50,
      "notes": "Entregar preferiblemente por la mañana"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-123",
    "tenantId": "tenant-uuid-123",
    "supplierId": "supp-uuid-123",
    "supplierName": "Proveedora Local S.L.",
    "orderNumber": "ORD-20260603-001",
    "status": "DRAFT",
    "urgency": "MEDIUM",
    "scheduledDelivery": "2026-06-05T10:00:00Z",
    "estimatedCost": 510.00,
    "createdAt": "2026-06-03T10:30:00Z",
    "createdBy": "user-uuid-123",
    "items": [
      {
        "id": "item-uuid-123",
        "productId": "prod-uuid-123",
        "productName": "Tomates frescos",
        "requestedQuantity": 20,
        "unit": "Kilogramos",
        "unitPrice": 25.50,
        "totalCost": 510.00
      }
    ]
  },
  "message": "Order generated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/orders/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-uuid-123",
    "supplierId": "supp-uuid-123",
    "urgency": "MEDIUM",
    "scheduledDelivery": "2026-06-05T10:00:00Z",
    "items": [
      {
        "productId": "prod-uuid-123",
        "requestedQuantity": 20,
        "unitPrice": 25.50
      }
    ]
  }'
```

**Ejemplo JavaScript:**
```javascript
const generateOrder = async (orderData) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3001/api/v1/orders/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });
  
  return await response.json();
};
```

#### 2.4.3 Obtener Pedido

**Endpoint:** `GET /api/v1/orders/:orderId`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-123",
    "orderNumber": "ORD-20260603-001",
    "status": "APPROVED",
    "urgency": "MEDIUM",
    "supplierName": "Proveedora Local S.L.",
    "estimatedCost": 510.00,
    "items": [
      {
        "id": "item-uuid-123",
        "productName": "Tomates frescos",
        "requestedQuantity": 20,
        "adjustedQuantity": 20,
        "unit": "Kilogramos",
        "unitPrice": 25.50,
        "totalCost": 510.00
      }
    ],
    "createdAt": "2026-06-03T10:30:00Z",
    "approvedBy": "user-uuid-456",
    "approvedAt": "2026-06-03T11:00:00Z"
  }
}
```

#### 2.4.4 Actualizar Item de Pedido

**Endpoint:** `PUT /api/v1/orders/:orderId/items/:itemId`

**Request Body:**
```json
{
  "adjustedQuantity": 25,
  "notes": "Aumentar cantidad por alta demanda"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "item-uuid-123",
    "adjustedQuantity": 25,
    "totalCost": 637.50,
    "notes": "Aumentar cantidad por alta demanda"
  },
  "message": "Order item updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PUT http://localhost:3001/api/v1/orders/order-uuid-123/items/item-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustedQuantity": 25,
    "notes": "Aumentar cantidad por alta demanda"
  }'
```

**Ejemplo JavaScript:**
```javascript
const updateOrderItem = async (orderId, itemId, updates) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return await response.json();
};
```

#### 2.4.5 Aprobar Pedido

**Endpoint:** `POST /api/v1/orders/:orderId/approve`

**Request Body:**
```json
{
  "approvedBy": "user-uuid-456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-123",
    "status": "APPROVED",
    "approvedBy": "user-uuid-456",
    "approvedAt": "2026-06-03T11:00:00Z"
  },
  "message": "Order approved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/orders/order-uuid-123/approve \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "user-uuid-456"}'
```

**Ejemplo JavaScript:**
```javascript
const approveOrder = async (orderId, approverId) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ approvedBy: approverId })
  });
  
  return await response.json();
};
```

#### 2.4.6 Enviar Pedido

**Endpoint:** `POST /api/v1/orders/:orderId/send`

**Request Body:**
```json
{
  "sentBy": "user-uuid-456",
  "deliveryMethod": "email"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-123",
    "status": "SENT",
    "sentAt": "2026-06-03T11:30:00Z",
    "sentBy": "user-uuid-456"
  },
  "message": "Order sent successfully"
}
```

#### 2.4.7 Obtener Historial de Pedidos

**Endpoint:** `GET /api/v1/orders/history`

**Query Parameters:**
- `tenantId` (string, requerido): ID del tenant

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-uuid-123",
      "orderNumber": "ORD-20260603-001",
      "supplierName": "Proveedora Local S.L.",
      "status": "RECEIVED",
      "estimatedCost": 510.00,
      "createdAt": "2026-06-03T10:30:00Z"
    }
  ],
  "message": "Orders history retrieved successfully"
}
```

#### 2.4.8 Clasificar por Proveedor

**Endpoint:** `GET /api/v1/orders/classify/supplier`

**Query Parameters:**
- `tenantId` (string, requerido): ID del tenant
- `historicalPeriod` (number, opcional): Período histórico en días (default: 7)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "supplierId": "supp-uuid-123",
      "supplierName": "Proveedora Local S.L.",
      "categories": ["Verduras", "Frutas"],
      "conservationZones": ["Cámara fría"],
      "averageDeliveryTime": 24,
      "reliabilityScore": 4.5,
      "priceTier": "MEDIUM",
      "preferredStatus": "PREFERRED",
      "contactInfo": {
        "email": "pedidos@proveedora.com",
        "phone": "+34 900 123 456"
      },
      "orderMethods": ["email", "telefono", "web"]
    }
  ],
  "message": "Suppliers classified successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET "http://localhost:3001/api/v1/orders/classify/supplier?tenantId=tenant-uuid-123&historicalPeriod=7" \
  -H "Authorization: Bearer {token}"
```

#### 2.4.9 Exportar Pedido

**Endpoint:** `GET /api/v1/orders/:orderId/export/:format`

**Parámetros de Path:**
- `orderId` (string): ID del pedido
- `format` (string): 'PDF' o 'EXCEL'

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "template": {
      "id": "template-uuid-123",
      "supplierName": "Proveedora Local S.L.",
      "orderNumber": "ORD-20260603-001",
      "generationDate": "2026-06-03T10:00:00Z",
      "estimatedDelivery": "2026-06-05T10:00:00Z",
      "contactInfo": {
        "email": "pedidos@proveedora.com",
        "phone": "+34 900 123 456"
      },
      "orderItems": [
        {
          "productId": "prod-uuid-123",
          "productName": "Tomates frescos",
          "requestedQuantity": 20,
          "unit": "Kilogramos",
          "unitPrice": 25.50,
          "totalCost": 510.00,
          "specifications": "Entregar preferiblemente por la mañana"
        }
      ],
      "subtotal": 510.00,
      "taxes": 107.10,
      "shippingCost": 0,
      "total": 617.10,
      "notes": "Pedido urgente para fin de semana",
      "format": "PDF"
    },
    "downloadUrl": "https://chefchek.com/downloads/ORD-20260603-001.pdf"
  },
  "message": "Order exported successfully"
}
```

**Ejemplo cURL:**
```bash
# Exportar a PDF
curl -X GET http://localhost:3001/api/v1/orders/order-uuid-123/export/PDF \
  -H "Authorization: Bearer {token}"

# Exportar a Excel
curl -X GET http://localhost:3001/api/v1/orders/order-uuid-123/export/EXCEL \
  -H "Authorization: Bearer {token}"
```

---

### 2.5 Production (Producción)

Control de producción con lotes de trabajo, mise en place y asignaciones de tareas.

#### 2.5.1 Crear Lote de Trabajo

**Endpoint:** `POST /api/v1/production/batches`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
X-User-Id: {userId}
```

**Request Body:**
```json
{
  "name": "Producción del fin de semana",
  "description": "Preparativos para servicio especial",
  "scheduledDate": "2026-06-07T08:00:00Z",
  "recipes": [
    {
      "recipeId": "recipe-uuid-123",
      "portions": 100
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "batch-uuid-123",
    "name": "Producción del fin de semana",
    "description": "Preparativos para servicio especial",
    "status": "PENDING",
    "scheduledDate": "2026-06-07T08:00:00Z",
    "createdAt": "2026-06-03T10:00:00Z",
    "createdBy": "user-uuid-123",
    "recipes": [
      {
        "recipeId": "recipe-uuid-123",
        "recipeName": "Salsa de tomate casera",
        "portions": 100,
        "estimatedTime": 120
      }
    ]
  },
  "message": "Work batch created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/production/batches \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "X-User-Id: user-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Producción del fin de semana",
    "description": "Preparativos para servicio especial",
    "scheduledDate": "2026-06-07T08:00:00Z",
    "recipes": [
      {
        "recipeId": "recipe-uuid-123",
        "portions": 100
      }
    ]
  }'
```

**Ejemplo JavaScript:**
```javascript
const createWorkBatch = async (batchData) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  const userId = localStorage.getItem('userId');
  
  const response = await fetch('http://localhost:3001/api/v1/production/batches', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'X-User-Id': userId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(batchData)
  });
  
  return await response.json();
};
```

#### 2.5.2 Listar Lotes de Trabajo

**Endpoint:** `GET /api/v1/production/batches`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "batch-uuid-123",
      "name": "Producción del fin de semana",
      "status": "IN_PROGRESS",
      "scheduledDate": "2026-06-07T08:00:00Z",
      "createdAt": "2026-06-03T10:00:00Z"
    }
  ],
  "message": "Work batches retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/production/batches \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### 2.5.3 Iniciar Lote de Trabajo

**Endpoint:** `POST /api/v1/production/batches/:batchId/start`

**Headers:**
```
Authorization: Bearer {accessToken}
X-User-Id: {userId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "batch-uuid-123",
    "status": "IN_PROGRESS",
    "startedAt": "2026-06-07T08:00:00Z",
    "startedBy": "user-uuid-123"
  },
  "message": "Work batch started successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/production/batches/batch-uuid-123/start \
  -H "Authorization: Bearer {token}" \
  -H "X-User-Id: user-uuid-123"
```

#### 2.5.4 Completar Lote de Trabajo

**Endpoint:** `POST /api/v1/production/batches/:batchId/complete`

**Headers:**
```
Authorization: Bearer {accessToken}
X-User-Id: {userId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "batch-uuid-123",
    "status": "COMPLETED",
    "completedAt": "2026-06-07T12:00:00Z",
    "completedBy": "user-uuid-123"
  },
  "message": "Work batch completed successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/production/batches/batch-uuid-123/complete \
  -H "Authorization: Bearer {token}" \
  -H "X-User-Id: user-uuid-123"
```

#### 2.5.5 Crear Hoja de Mise en Place

**Endpoint:** `POST /api/v1/production/mise-en-place`

**Request Body:**
```json
{
  "name": "Mise en place - Servicio mañana",
  "scheduledDate": "2026-06-04T07:00:00Z",
  "zone": "Cocina principal",
  "items": [
    {
      "recipeId": "recipe-uuid-123",
      "quantity": 50,
      "unit": "porciones",
      "priority": "HIGH"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "mise-uuid-123",
    "name": "Mise en place - Servicio mañana",
    "status": "PENDING",
    "scheduledDate": "2026-06-04T07:00:00Z",
    "zone": "Cocina principal",
    "items": [
      {
        "id": "item-uuid-123",
        "recipeId": "recipe-uuid-123",
        "recipeName": "Salsa de tomate casera",
        "quantity": 50,
        "unit": "porciones",
        "priority": "HIGH",
        "status": "PENDING"
      }
    ],
    "createdAt": "2026-06-03T10:00:00Z"
  },
  "message": "Mise en place sheet created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/production/mise-en-place \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mise en place - Servicio mañana",
    "scheduledDate": "2026-06-04T07:00:00Z",
    "zone": "Cocina principal",
    "items": [
      {
        "recipeId": "recipe-uuid-123",
        "quantity": 50,
        "unit": "porciones",
        "priority": "HIGH"
      }
    ]
  }'
```

#### 2.5.6 Actualizar Item de Mise en Place

**Endpoint:** `PUT /api/v1/production/mise-en-place/items/:itemId`

**Request Body:**
```json
{
  "status": "IN_PROGRESS"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "item-uuid-123",
    "status": "IN_PROGRESS",
    "updatedAt": "2026-06-03T11:00:00Z"
  },
  "message": "Mise en place item updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PUT http://localhost:3001/api/v1/production/mise-en-place/items/item-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'
```

#### 2.5.7 Crear Asignación de Tarea

**Endpoint:** `POST /api/v1/production/assignments`

**Request Body:**
```json
{
  "staffId": "staff-uuid-123",
  "orderId": "order-uuid-123",
  "taskId": "task-uuid-456",
  "assignedBy": "user-uuid-123",
  "priority": "HIGH",
  "estimatedTime": 60
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "assignment-uuid-123",
    "staffId": "staff-uuid-123",
    "staffName": "Chef Juan",
    "orderId": "order-uuid-123",
    "taskId": "task-uuid-456",
    "taskName": "Preparar salsas",
    "priority": "HIGH",
    "estimatedTime": 60,
    "status": "ASSIGNED",
    "assignedAt": "2026-06-03T10:00:00Z",
    "assignedBy": "user-uuid-123"
  },
  "message": "Task assignment created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/production/assignments \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff-uuid-123",
    "orderId": "order-uuid-123",
    "taskId": "task-uuid-456",
    "assignedBy": "user-uuid-123",
    "priority": "HIGH",
    "estimatedTime": 60
  }'
```

#### 2.5.8 Generar Reporte de Producción

**Endpoint:** `POST /api/v1/production/reports`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Request Body:**
```json
{
  "startDate": "2026-06-01T00:00:00Z",
  "endDate": "2026-06-03T23:59:59Z",
  "includeCosts": true,
  "includePerformance": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reportId": "report-uuid-123",
    "period": {
      "startDate": "2026-06-01T00:00:00Z",
      "endDate": "2026-06-03T23:59:59Z"
    },
    "summary": {
      "totalBatches": 15,
      "completedBatches": 12,
      "inProgressBatches": 3,
      "totalRecipesProduced": 145,
      "totalProductionTime": 1800,
      "averageBatchTime": 120
    },
    "performance": {
      "onTimeCompletionRate": 85.5,
      "averageEfficiency": 92.3,
      "topPerformers": [
        {
          "staffId": "staff-uuid-123",
          "staffName": "Chef Juan",
          "completedTasks": 25,
          "efficiency": 95.5
        }
      ]
    },
    "costs": {
      "totalProductionCost": 3450.00,
      "laborCost": 1200.00,
      "ingredientCost": 2250.00
    }
  },
  "message": "Production report generated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/production/reports \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-06-03T23:59:59Z",
    "includeCosts": true,
    "includePerformance": true
  }'
```

---

### 2.6 Tenants (Tenants Multi-tenant)

Gestión de tenants para la arquitectura multi-tenant de ChefChek.

#### 2.6.1 Crear Tenant

**Endpoint:** `POST /api/v1/tenants`

**Request Body:**
```json
{
  "name": "Restaurante La Mesa",
  "slug": "la-mesa",
  "email": "contacto@lamesa.com",
  "phone": "+34 900 123 456",
  "address": {
    "street": "Calle Principal 123",
    "city": "Madrid",
    "postalCode": "28001",
    "country": "España"
  },
  "settings": {
    "timezone": "Europe/Madrid",
    "currency": "EUR",
    "language": "es"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "tenant-uuid-123",
    "name": "Restaurante La Mesa",
    "slug": "la-mesa",
    "email": "contacto@lamesa.com",
    "phone": "+34 900 123 456",
    "address": {
      "street": "Calle Principal 123",
      "city": "Madrid",
      "postalCode": "28001",
      "country": "España"
    },
    "settings": {
      "timezone": "Europe/Madrid",
      "currency": "EUR",
      "language": "es"
    },
    "isActive": true,
    "createdAt": "2026-06-03T10:00:00Z",
    "updatedAt": "2026-06-03T10:00:00Z"
  },
  "message": "Tenant created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Restaurante La Mesa",
    "slug": "la-mesa",
    "email": "contacto@lamesa.com",
    "phone": "+34 900 123 456",
    "address": {
      "street": "Calle Principal 123",
      "city": "Madrid",
      "postalCode": "28001",
      "country": "España"
    },
    "settings": {
      "timezone": "Europe/Madrid",
      "currency": "EUR",
      "language": "es"
    }
  }'
```

**Ejemplo JavaScript:**
```javascript
const createTenant = async (tenantData) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3001/api/v1/tenants', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tenantData)
  });
  
  return await response.json();
};
```

#### 2.6.2 Listar Tenants

**Endpoint:** `GET /api/v1/tenants`

**Query Parameters:**
- `page` (number, opcional): Número de página (default: 1)
- `limit` (number, opcional): Resultados por página (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-uuid-123",
      "name": "Restaurante La Mesa",
      "slug": "la-mesa",
      "email": "contacto@lamesa.com",
      "isActive": true,
      "createdAt": "2026-06-03T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "message": "Tenants retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
# Listar todos los tenants
curl -X GET http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer {token}"

# Paginación
curl -X GET "http://localhost:3001/api/v1/tenants?page=1&limit=10" \
  -H "Authorization: Bearer {token}"
```

**Ejemplo JavaScript:**
```javascript
const getTenants = async (page = 1, limit = 20) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:3001/api/v1/tenants?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

#### 2.6.3 Obtener Tenant por ID

**Endpoint:** `GET /api/v1/tenants/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "tenant-uuid-123",
    "name": "Restaurante La Mesa",
    "slug": "la-mesa",
    "email": "contacto@lamesa.com",
    "phone": "+34 900 123 456",
    "address": {
      "street": "Calle Principal 123",
      "city": "Madrid",
      "postalCode": "28001",
      "country": "España"
    },
    "settings": {
      "timezone": "Europe/Madrid",
      "currency": "EUR",
      "language": "es"
    },
    "isActive": true,
    "createdAt": "2026-06-03T10:00:00Z",
    "updatedAt": "2026-06-03T10:00:00Z"
  },
  "message": "Tenant retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/tenants/tenant-uuid-123 \
  -H "Authorization: Bearer {token}"
```

#### 2.6.4 Actualizar Tenant

**Endpoint:** `PATCH /api/v1/tenants/:id`

**Request Body (parcial):**
```json
{
  "name": "Restaurante La Mesa - Central",
  "settings": {
    "timezone": "Europe/Madrid",
    "currency": "EUR",
    "language": "es"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "tenant-uuid-123",
    "name": "Restaurante La Mesa - Central",
    "settings": {
      "timezone": "Europe/Madrid",
      "currency": "EUR",
      "language": "es"
    },
    "updatedAt": "2026-06-03T11:00:00Z"
  },
  "message": "Tenant updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PATCH http://localhost:3001/api/v1/tenants/tenant-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Restaurante La Mesa - Central",
    "settings": {
      "timezone": "Europe/Madrid",
      "currency": "EUR",
      "language": "es"
    }
  }'
```

**Ejemplo JavaScript:**
```javascript
const updateTenant = async (tenantId, updates) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:3001/api/v1/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return await response.json();
};
```

#### 2.6.5 Eliminar Tenant

**Endpoint:** `DELETE /api/v1/tenants/:id`

**Response (204 No Content):**
```
(Sin cuerpo de respuesta)
```

**Ejemplo cURL:**
```bash
curl -X DELETE http://localhost:3001/api/v1/tenants/tenant-uuid-123 \
  -H "Authorization: Bearer {token}"
```

**Ejemplo JavaScript:**
```javascript
const deleteTenant = async (tenantId) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:3001/api/v1/tenants/${tenantId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.status === 204;
};
```

---

### 2.7 Users (Usuarios)

Gestión de usuarios con roles y permisos.

#### 2.7.1 Crear Usuario

**Endpoint:** `POST /api/v1/users`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Request Body:**
```json
{
  "email": "nuevo.usuario@ejemplo.com",
  "password": "contraseña123",
  "name": "María García",
  "role": "USER",
  "phone": "+34 600 123 456",
  "position": "Cocinera"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-456",
    "email": "nuevo.usuario@ejemplo.com",
    "name": "María García",
    "role": "USER",
    "phone": "+34 600 123 456",
    "position": "Cocinera",
    "isActive": true,
    "tenantId": "tenant-uuid-123",
    "createdAt": "2026-06-03T10:30:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "User created successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo.usuario@ejemplo.com",
    "password": "contraseña123",
    "name": "María García",
    "role": "USER",
    "phone": "+34 600 123 456",
    "position": "Cocinera"
  }'
```

**Ejemplo JavaScript:**
```javascript
const createUser = async (userData) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch('http://localhost:3001/api/v1/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  
  return await response.json();
};
```

#### 2.7.2 Listar Usuarios

**Endpoint:** `GET /api/v1/users`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Query Parameters:**
- `page` (number, opcional): Número de página (default: 1)
- `limit` (number, opcional): Resultados por página (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid-123",
      "email": "juan.perez@ejemplo.com",
      "name": "Juan Pérez",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2026-06-01T10:00:00Z"
    },
    {
      "id": "user-uuid-456",
      "email": "maria.garcia@ejemplo.com",
      "name": "María García",
      "role": "USER",
      "isActive": true,
      "createdAt": "2026-06-03T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  },
  "message": "Users retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
# Listar usuarios (primera página)
curl -X GET "http://localhost:3001/api/v1/users?page=1&limit=20" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const getUsers = async (page = 1, limit = 20) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/users?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return await response.json();
};
```

#### 2.7.3 Obtener Usuario por ID

**Endpoint:** `GET /api/v1/users/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "email": "juan.perez@ejemplo.com",
    "name": "Juan Pérez",
    "role": "ADMIN",
    "phone": "+34 600 123 456",
    "position": "Chef Ejecutivo",
    "isActive": true,
    "tenantId": "tenant-uuid-123",
    "createdAt": "2026-06-01T10:00:00Z",
    "updatedAt": "2026-06-03T10:30:00Z"
  },
  "message": "User retrieved successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X GET http://localhost:3001/api/v1/users/user-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### 2.7.4 Actualizar Usuario

**Endpoint:** `PATCH /api/v1/users/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Request Body (parcial):**
```json
{
  "name": "Juan Pérez Martínez",
  "role": "ADMIN",
  "position": "Chef Ejecutivo Senior"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "name": "Juan Pérez Martínez",
    "role": "ADMIN",
    "position": "Chef Ejecutivo Senior",
    "updatedAt": "2026-06-03T11:00:00Z"
  },
  "message": "User updated successfully"
}
```

**Ejemplo cURL:**
```bash
curl -X PATCH http://localhost:3001/api/v1/users/user-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Pérez Martínez",
    "role": "ADMIN",
    "position": "Chef Ejecutivo Senior"
  }'
```

**Ejemplo JavaScript:**
```javascript
const updateUser = async (userId, updates) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return await response.json();
};
```

#### 2.7.5 Eliminar Usuario

**Endpoint:** `DELETE /api/v1/users/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Id: {tenantId}
```

**Response (204 No Content):**
```
(Sin cuerpo de respuesta)
```

**Ejemplo cURL:**
```bash
curl -X DELETE http://localhost:3001/api/v1/users/user-uuid-456 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

**Ejemplo JavaScript:**
```javascript
const deleteUser = async (userId) => {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch(`http://localhost:3001/api/v1/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId
    }
  });
  
  return response.status === 204;
};
```

---

## 3. Integración con APIs

### 3.1 Guía Quickstart para Integradores

Esta guía está diseñada para desarrolladores que desean integrar ChefChek con sus sistemas externos.

#### Paso 1: Obtener Credenciales

Contacta al administrador del sistema para obtener:
- Tenant ID de tu organización
- Usuario con permisos de API
- Credenciales de acceso (email y password temporal)

#### Paso 2: Realizar Login y Obtener Token

```javascript
const chefchekClient = {
  baseUrl: 'http://localhost:3001/api',
  
  async login(email, password, tenantId) {
    const response = await fetch(`${this.baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      this.token = data.data.accessToken;
      this.sessionId = data.data.sessionId;
      this.tenantId = tenantId;
      return data.data;
    }
    
    throw new Error('Login failed');
  },
  
  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'X-Tenant-Id': this.tenantId,
        ...options.headers
      }
    });
    
    if (response.status === 401) {
      // Token expirado, intentar refresh
      await this.refreshToken();
      // Reintentar request
      return this.request(endpoint, options);
    }
    
    return response.json();
  },
  
  async refreshToken() {
    const response = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId })
    });
    
    const data = await response.json();
    if (data.success) {
      this.token = data.data.accessToken;
    }
  }
};

// Uso:
const client = new chefchekClient();
await client.login('usuario@ejemplo.com', 'password', 'tenant-uuid-123');
```

#### Paso 3: Ejemplos de Operaciones Comunes

```javascript
// Obtener productos
const products = await client.request('/v1/products');

// Crear receta
const recipe = await client.request('/v1/recipes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Nueva receta',
    elaboration: '{"type":"doc","content":[]}',
    portions: 10
  })
});

// Generar pedido
const order = await client.request('/v1/orders/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: client.tenantId,
    supplierId: 'supp-uuid-123',
    urgency: 'MEDIUM',
    items: []
  })
});
```

### 3.2 Rate Limits

ChefChek implementa límites de velocidad para proteger la estabilidad del servicio:

**Límites Actuales:**
- 100 requests por minuto por IP
- 1000 requests por hora por tenant

**Response en caso de exceder límite:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Has excedido el límite de solicitudes. Por favor, espera antes de intentar nuevamente.",
    "retryAfter": 60
  }
}
```

**Headers de Rate Limit en responses:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
```

### 3.3 Paginación

La mayoría de endpoints de listado soportan paginación:

**Parámetros de query:**
- `page` (number, opcional): Número de página (default: 1)
- `limit` (number, opcional): Resultados por página (default: 20, max: 100)

**Response con paginación:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  },
  "message": "Data retrieved successfully"
}
```

### 3.4 Filtrado y Ordenamiento

**Filtros comunes (varían por endpoint):**
```bash
# Filtrar por categoría
GET /api/v1/products?category=Verduras

# Buscar por texto
GET /api/v1/products?search=tomates

# Filtrar por estado
GET /api/v1/products?isActive=true

# Combinar filtros
GET /api/v1/products?category=Verduras&isActive=true&search=tomates
```

**Ordenamiento:**
```bash
# Ordenar ascendente
GET /api/v1/products?sortBy=name&sortOrder=asc

# Ordenar descendente
GET /api/v1/products?sortBy=createdAt&sortOrder=desc
```

### 3.5 Formato de Respuesta de Error

**Estructura estándar de error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción detallada del error",
    "details": {
      "field": "Valor inválido"
    }
  }
}
```

---

## 4. Códigos de Error y Respuestas

### 4.1 Formato Estándar de Error

Todas las respuestas de error siguen este formato:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error",
    "details": {}
  }
}
```

### 4.2 Códigos de Estado HTTP

| Código | Descripción | Ejemplo de Uso |
|--------|-------------|----------------|
| **200 OK** | Request exitoso | GET, PUT, PATCH |
| **201 Created** | Recurso creado exitosamente | POST |
| **204 No Content** | Request exitoso sin contenido en respuesta | DELETE, logout |
| **400 Bad Request** | Datos inválidos o malformados | Validación fallida |
| **401 Unauthorized** | No autenticado o token inválido | Sin token, token expirado |
| **403 Forbidden** | Autenticado pero sin permisos | Rol insuficiente |
| **404 Not Found** | Recurso no encontrado | ID inválido |
| **409 Conflict** | Conflicto con estado actual | Duplicado, restricción |
| **500 Internal Server Error** | Error del servidor | Error inesperado |

### 4.3 Códigos de Error Específicos

#### Errores de Autenticación

| Código | HTTP | Descripción |
|--------|------|-------------|
| `NO_SESSION` | 401 | No se proporcionó token de sesión |
| `INVALID_SESSION` | 401 | Token inválido o expirado |
| `UNAUTHORIZED` | 401 | Usuario no autenticado |
| `INVALID_CREDENTIALS` | 401 | Credenciales de login inválidas |
| `USER_NOT_FOUND` | 404 | Usuario no encontrado en login |
| `SESSION_EXPIRED` | 401 | Sesión expirada |

**Ejemplo de respuesta:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Las credenciales proporcionadas son inválidas"
  }
}
```

#### Errores de Tenant

| Código | HTTP | Descripción |
|--------|------|-------------|
| `TENANT_REQUIRED` | 400 | Header X-Tenant-Id no proporcionado |
| `TENANT_NOT_FOUND` | 404 | Tenant no encontrado |
| `TENANT_INACTIVE` | 403 | Tenant está inactivo |

**Ejemplo de respuesta:**
```json
{
  "success": false,
  "error": {
    "code": "TENANT_REQUIRED",
    "message": "El header X-Tenant-Id es requerido para esta operación"
  }
}
```

#### Errores de Validación

| Código | HTTP | Descripción |
|--------|------|-------------|
| `VALIDATION_ERROR` | 400 | Error de validación de datos |
| `INVALID_EMAIL` | 400 | Formato de email inválido |
| `INVALID_PASSWORD` | 400 | Contraseña inválida |
| `REQUIRED_FIELD` | 400 | Campo requerido faltante |
| `INVALID_FORMAT` | 400 | Formato inválido |

**Ejemplo de respuesta con detalles:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación",
    "details": {
      "email": "Formato de email inválido",
      "password": "La contraseña debe tener al menos 8 caracteres"
    }
  }
}
```

#### Errores de Recursos

| Código | HTTP | Descripción |
|--------|------|-------------|
| `RESOURCE_NOT_FOUND` | 404 | Recurso no encontrado |
| `RESOURCE_ALREADY_EXISTS` | 409 | Recurso ya existe |
| `RESOURCE_IN_USE` | 409 | Recurso en uso, no se puede eliminar |

**Ejemplo de respuesta:**
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Producto con ID 'prod-uuid-999' no encontrado"
  }
}
```

#### Errores de Permisos

| Código | HTTP | Descripción |
|--------|------|-------------|
| `INSUFFICIENT_PERMISSIONS` | 403 | Permisos insuficientes |
| `ADMIN_ONLY` | 403 | Operación solo permitida para admin |
| `ROLE_REQUIRED` | 403 | Rol específico requerido |

**Ejemplo de respuesta:**
```json
{
  "success": false,
  "error": {
    "code": "ADMIN_ONLY",
    "message": "Esta operación solo puede ser realizada por usuarios con rol ADMIN"
  }
}
```

### 4.4 Errores Comunes y Soluciones

#### Token Expirado (401)

**Situación:** Intentas usar un token JWT que ha expirado.

**Solución:** Usa el endpoint de refresh para obtener un nuevo token:

```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "your-session-id"}'
```

#### Tenant No Proporcionado (400)

**Situación:** Olvidaste incluir el header `X-Tenant-Id`.

**Solución:** Incluye el header en todos los requests autenticados:

```bash
curl -X GET http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### Validación Fallida (400)

**Situación:** Los datos enviados no pasan la validación.

**Solución:** Revisa los campos en `error.details` y corrige los datos:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación",
    "details": {
      "purchasePrice": "El precio debe ser un número positivo",
      "portions": "Las porciones deben ser al menos 1"
    }
  }
}
```

#### Recurso No Encontrado (404)

**Situación:** Intentas acceder a un recurso que no existe.

**Solución:** Verifica que el ID sea correcto y que el recurso exista:

```bash
# Verificar que el producto existe
curl -X GET http://localhost:3001/api/v1/products/prod-uuid-123 \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Id: tenant-uuid-123"
```

#### Permisos Insuficientes (403)

**Situación:** No tienes el rol necesario para la operación.

**Solución:** Contacta al administrador para solicitar los permisos necesarios, o usa una cuenta con rol apropiado.

---

## 5. Swagger UI

ChefChek incluye una interfaz Swagger UI interactiva para explorar y probar la API.

### 5.1 Acceder a Swagger UI

**URL:** `http://localhost:3001/api/docs`

Abre esta URL en tu navegador para acceder a la documentación interactiva.

### 5.2 Autorizar con JWT

1. Haz clic en el botón **"Authorize"** en la parte superior derecha
2. Ingresa tu token JWT en el formato: `Bearer YOUR_TOKEN_HERE`
3. Haz clic en **"Authorize"**
4. Cierra el modal

Ahora puedes probar los endpoints autenticados.

### 5.3 Grupos de Tags Disponibles

Los endpoints están organizados por tags:

| Tag | Descripción |
|-----|-------------|
| **Tenants** | Gestión de tenants multi-tenant |
| **Auth** | Autenticación y gestión de sesiones |
| **Users** | Gestión de usuarios |
| **Products** | Gestión de productos e ingredientes |
| **Recipes** | Gestión de recetas y escandallos |
| **Menus** | Gestión de menús y cartas |
| **TechnicalSheets** | Fichas técnicas parametrizadas |
| **Production** | Control de producción |
| **Appcc** | Sistema APPCC y control sanitario |
| **Allergens** | Gestión de alérgenos (UE 1169/2011) |
| **Orders** | Gestión de pedidos |
| **Almacenes** | Gestión de almacenes e inventarios |
| **Conocimiento** | Wiki de procedimientos operativos |
| **DigitalMenu** | Cartas digitales QR y analytics |
| **Dashboard** | KPIs, métricas y alertas |

### 5.4 Usar Try-It-Out

Swagger UI incluye una funcionalidad "Try it out" para probar endpoints directamente:

1. Expande el endpoint que deseas probar
2. Haz clic en **"Try it out"**
3. Completa los parámetros requeridos
4. Haz clic en **"Execute"**
5. Revisa la respuesta en la sección "Response"

**Ejemplo:** Probar el endpoint de login:

```
POST /api/v1/auth/login
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "tenantId": "tenant-uuid-123"
}
```

### 5.5 Ventajas de Swagger UI

- **Exploración interactiva:** Navega fácilmente entre endpoints
- **Pruebas rápidas:** Ejecuta requests directamente desde el navegador
- **Documentación en vivo:** Siempre sincronizada con la API actual
- **Esquemas completos:** Visualiza request/response schemas
- **Autorización simplificada:** Prueba endpoints autenticados fácilmente

---

## Anexos

### Anexo A: Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Acceso completo a todos los endpoints |
| **USER** | Operaciones de CRUD en recursos propios |
| **VIEWER** | Solo lectura de recursos |

### Anexo B: Enums Comunes

#### Urgency (Urgencia de Pedido)
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

#### OrderStatus (Estado de Pedido)
- `DRAFT`
- `REVIEW`
- `APPROVED`
- `SENT`
- `RECEIVED`
- `CANCELLED`

#### PreferredStatus (Estado de Proveedor)
- `PREFERRED`
- `ALTERNATIVE`
- `EMERGENCY`

#### PriceTier (Nivel de Precio)
- `LOW`
- `MEDIUM`
- `HIGH`

### Anexo C: Formatos de Fecha

Todas las fechas siguen el formato ISO 8601:
```
2026-06-03T10:30:00Z
```

### Anexo D: Soporte

Para consultas técnicas sobre la API:
- **Documentación:** `http://localhost:3001/api/docs`
- **Email:** `support@chefchek.com`
- **Issues:** Reporta problemas en el repositorio del proyecto

---

**Última actualización:** Junio 3, 2026  
**Versión de la API:** 0.1.0  
**Versión de la documentación:** 1.0.0
