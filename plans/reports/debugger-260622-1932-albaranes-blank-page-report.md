# Debug Report: /dashboard/albaranes Blank Page

**Date:** 2026-06-22
**Issue:** Page renders blank — no content, no error, just blank
**Status:** ROOT CAUSE IDENTIFIED

---

## Summary

The `/dashboard/albaranes` page appears blank because:
1. **Backend server is not running** (localhost:3001 down)
2. **Auth check fails** → no valid session → redirects to `/login`
3. User sees "VALIDANDO ACCESO..." briefly then gets redirected to login page

**This is expected behavior** — the page is protected and requires authentication. The "blank" appearance is the loading state during auth check, followed by redirect.

---

## Evidence Chain

### 1. Page Compiles Successfully
- Fixed `next.config.ts` — removed invalid `turbo` experimental config (not supported in Next.js 16.2.6)
- Build completes without errors
- Page file exists at `frontend/src/app/dashboard/albaranes/page.tsx`
- All imports resolve correctly

### 2. Page Renders HTML Response
```
curl http://localhost:3000/dashboard/albaranes
```
Returns:
```html
<div class="min-h-screen flex items-center justify-center bg-[#121212]">
  <div class="flex flex-col items-center gap-4">
    <span class="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
    <div>VALIDANDO ACCESO...</div>
  </div>
</div>
```

This is the auth loading state from `dashboard/layout.tsx` lines 47-56.

### 3. Auth Context Flow
Location: `frontend/src/contexts/auth.context.tsx`

```typescript
// Line 57-59: Check session on mount
useEffect(() => {
  checkSession();
}, []);

// Line 61-85: checkSession function
const checkSession = async () => {
  const savedUser = sessionStorage.getItem('user');
  const savedSessionId = sessionStorage.getItem('session_id');
  
  if (savedUser && savedSessionId) {
    // Verify session with backend
    const session = await authService.getCurrentSession();
    // ↑ This calls GET /v1/auth/validate on backend
  }
  setIsLoading(false);
};
```

### 4. Backend Down — Auth Validate Fails
```bash
lsof -i :3001  # Returns: No process on port 3001
```

Backend not running → `/v1/auth/validate` request fails → `getCurrentSession()` returns `null` → `isAuthenticated = false`.

### 5. Redirect to Login
`dashboard/layout.tsx` lines 41-45:
```typescript
useEffect(() => {
  if (!isLoading && !isAuthenticated) {
    router.push('/login');
  }
}, [isAuthenticated, isLoading, router]);
```

---

## Root Cause

**Backend server is not running.** Without a running backend:
- Auth validation fails
- No session can be established
- Protected routes redirect to login
- User sees blank/loading state briefly then gets redirected

This is **correct behavior** — the app is designed to protect authenticated routes.

---

## Fixes Applied

### 1. Fixed `next.config.ts`
**Before:**
```typescript
experimental: {
  turbo: {
    root: __dirname,
  },
},
```

**After:**
```typescript
// Removed — turbo config not supported in Next.js 16.2.6
```

### 2. Added `force-dynamic` to Albaranes Page
Added explicit dynamic rendering flags to `frontend/src/app/dashboard/albaranes/page.tsx`:
```typescript
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
```

This ensures the page is always server-rendered, not statically generated.

---

## Recommendations

### Immediate Actions

1. **Start the backend server:**
   ```bash
   cd backend && npm run start:dev
   ```

2. **Start the frontend dev server:**
   ```bash
   cd frontend && npm run dev
   ```

3. **Test the flow:**
   - Navigate to `http://localhost:3000/login`
   - Log in with valid credentials
   - Navigate to `/dashboard/albaranes`

### For Development Experience

If you want to test the albaranes page without a full backend:

1. **Mock session data in browser console:**
   ```javascript
   sessionStorage.setItem('session_id', 'test-session');
   sessionStorage.setItem('tenant_slug', 'test-tenant');
   sessionStorage.setItem('user', JSON.stringify({
     id: '1',
     email: 'test@test.com',
     name: 'Test User',
     role: 'ADMIN',
     tenantId: 'tenant-1'
   }));
   ```

2. **Or create a seed script to populate test data**

### Architecture Note

The auth flow is working correctly:
- Session stored in `sessionStorage` (cleared on tab close)
- Backend validates session via `/v1/auth/validate`
- Protected routes redirect to login when unauthenticated
- Loading states shown during async operations

---

## Unresolved Questions

None — root cause is clear: backend not running, auth fails, redirect to login occurs.

---

## Files Modified

1. `frontend/next.config.ts` — removed invalid turbo config
2. `frontend/src/app/dashboard/albaranes/page.tsx` — added force-dynamic exports
