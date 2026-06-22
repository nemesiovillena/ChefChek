# Backend Auth Endpoints 404 - Debugging Report

## Problem
Frontend auth flow blocked - `/api/v1/auth/login` returns 404 Not Found

## Investigation Process

### Step 1: Verify Backend Status
✅ Backend running on port 3001 (PID: 45159)
✅ Health endpoint `/health` responds: `{"status":"ok"}`
✅ Swagger UI available at `/api/docs`
❌ Auth endpoints not accessible

### Step 2: Test Auth Endpoints
```bash
# Without tenant slug header
curl -X POST http://localhost:3001/api/v1/auth/login ...
# Response: 403 "X-Tenant-Slug header is required"

# With tenant slug header  
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "X-Tenant-Slug: chefchek-demo" ...
# Response: 404 "Cannot POST /api/v1/auth/login"
```

### Step 3: Check Module Configuration
✅ **AuthModule** (`backend/src/modules/auth/auth.module.ts`):
- Correctly imports AuthController
- All providers configured (AuthService, LuciaAuthService, etc.)
- Services exported correctly

✅ **AppModule** (`backend/src/app.module.ts`):
- AuthModule imported (lines 14, 56)
- AuthController imported (line 25)
- **CRITICAL**: Auth routes excluded from TenantMiddleware:
  ```typescript
  consumer
    .apply(TenantMiddleware)
    .exclude(
      { path: "api/v1/auth/login", method: RequestMethod.POST },
      { path: "api/v1/tenants", method: RequestMethod.POST },
      { path: "api/v1/tenants", method: RequestMethod.GET },
    )
    .forRoutes("*");
  ```

### Step 4: Analyze TenantMiddleware
✅ **TenantMiddleware** (`backend/src/middleware/tenant.middleware.ts`):
- Requires X-Tenant-Slug header on ALL requests (line 37)
- Throws ForbiddenException if header missing
- **ISSUE**: Exclusions in app.module.ts not being respected

## Root Cause

**Middleware exclusion not working**: TenantMiddleware is rejecting requests even for routes explicitly excluded in `configure(consumer)`.

The exclusion configuration in app.module.ts should prevent TenantMiddleware from running on:
- `/api/v1/auth/login` (POST)
- `/api/v1/auth/logout` (POST)
- `/api/v1/auth/refresh` (POST)
- `/api/v1/auth/validate` (GET)
- `/api/v1/auth/sessions` (GET)
- `/api/v1/tenants` (POST, GET)

But the middleware is still executing and rejecting these routes.

### Additional Evidence

1. **GET request to `/api/v1/auth/login` returns 403 Forbidden** (not 404)
   - This proves the route EXISTS but is being blocked by middleware
   
2. **Swagger UI also blocked** by TenantMiddleware:
   ```bash
   curl http://localhost:3001/api/docs/openapi.json
   # Response: 403 "X-Tenant-Slug header is required"
   ```

3. **AuthController has correct decorators**:
   ```typescript
   @Controller("api/v1/auth")
   export class AuthController {
     @Post("login")
     async login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest)
   ```

## Hypotheses

### H1: Middleware Exclusion Order Problem
The exclusion configuration in `configure(consumer)` may not be applying correctly due to:
- Incorrect order of middleware application
- NestJS version-specific behavior
- Conflict with JwtAuthMiddleware

### H2: TenantMiddleware Logic Error
The TenantMiddleware always throws `ForbiddenException` at line 37 before checking exclusions.

### H3: Exclusion Path Mismatch
The path patterns in `.exclude()` may not match the actual route patterns being registered.

## Next Steps

### Immediate: Verify Exclusion Configuration
1. Check if TenantMiddleware is correctly implementing exclusion checking
2. Verify if the exclusion logic needs to be in the middleware itself
3. Test if removing exclusions and putting logic in middleware works

### Alternative: Fix TenantMiddleware
Modify TenantMiddleware to check for public routes:
```typescript
const publicRoutes = [
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/validate',
  '/api/v1/auth/sessions',
  '/api/v1/tenants',
];

async use(req: Request, res: Response, next: NextFunction) {
  // Skip tenant validation for public routes
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // Rest of tenant validation...
}
```

### Verification
1. Apply fix to TenantMiddleware
2. Test `/api/v1/auth/login` with proper credentials
3. Verify Swagger UI is accessible
4. Test full auth flow end-to-end

## Test Data
From seed.ts:
- **Tenant slug**: `chefchek-demo`
- **Admin email**: `admin@chefchek.local`
- **Admin password**: `admin123`

## Related Files
- `backend/src/app.module.ts` - Module configuration with exclusions
- `backend/src/middleware/tenant.middleware.ts` - Middleware requiring fix
- `backend/src/modules/auth/auth.controller.ts` - Auth endpoints (correct)
- `backend/src/modules/auth/auth.module.ts` - Auth module (correct)

## Resolution Status
🔴 **BLOCKER IDENTIFIED**: TenantMiddleware exclusion configuration not working

**Recommended Fix**: Move public route logic into TenantMiddleware instead of relying on `.exclude()` in app.module.ts.