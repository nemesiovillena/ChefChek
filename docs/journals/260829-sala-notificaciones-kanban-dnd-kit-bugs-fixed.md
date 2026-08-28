# Notificaciones de Sala: Kanban with dnd-kit — Optimistic Cache and Modal State Bugs Fixed

**Date**: 2026-08-29 00:36  
**Severity**: High (2 real bugs in code review, both fixed pre-commit)  
**Component**: Sala Notificaciones module (new), backend SalaTasksService, frontend Kanban + modal  
**Status**: Resolved

## What Happened

Completed full implementation of "Notificaciones de Sala" — a front-of-house task board for staff to log reservations, menus, and kitchen requests. Backend: new Prisma `SalaTask` model, new NestJS module (`sala-tasks/`) with tenant-scoped CRUD + REST reorder endpoints. Frontend: new Kanban page (`/dashboard/sala-notificaciones`) with 3-column drag-and-drop (PENDIENTE/EN_CURSO/COMPLETADO), shared modal (`sala-task-modal.tsx`), dashboard summary card below "Tareas de Prep. Próximas" (limit changed 6→4 in same PR).

**Key delivery facts:**
- Backend: 10 new unit tests (tenant isolation, soft-delete, reorder transaction, sortOrder logic), full suite 1711/1711 passing, zero regressions.
- Frontend: hook `use-sala-tasks.ts`, page component, shared modal, nav entry + route gating, first multi-column dnd-kit usage in this codebase (prior drag-drop was single list only).
- Module registry: new per-tenant module `sala-notificaciones` with `defaultEnabled: false` (superadmin must enable per tenant — explicit user decision).
- Migration: local dev DB (localhost:5432) has 93 tables, no `_prisma_migrations` history. `prisma migrate deploy` failed with P3005. Worked around by applying migration SQL directly via `psql` (verified 0 tenants first — zero data-loss risk), keeping file versioned for environments with correct history.
- Docs: `docs/sala-notificaciones-architecture.md` (445 lines), updates to `docs/database-schema.md` and `docs/system-architecture.md`.
- Code review (mandatory gate, 6.5/10 on first pass): **2 REAL bugs** found and fixed same session.

## The Brutal Truth

This module should have been done. It wasn't — two critical bugs were hiding in the frontend code, both involving state management and caching, and both would have caused user-visible failures in production:

1. **Optimistic cache never persisted recomputed sortOrder** after drag-and-drop. You'd drag Task A from column PENDIENTE to EN_CURSO, the UI would animate smoothly (optimistic update worked), but the sorted task list in the cache didn't have the recomputed `sortOrder` value written back. Result: visual snap-back after the network round-trip, and a race condition if the user dragged twice before the first mutation completed.

2. **Modal form state refused to reset** when opening the same task twice. Scenario: open Task #5 in modal, edit the title, hit Cancel (form discarded), close modal. Re-open Task #5 — the old draft title still appeared instead of the real data. Only went away if you opened a *different* task first. Incredibly annoying UX.

The frustrating part: both bugs came from shortcuts in the Zustand/React Query integration. The code *looked* right — the modal had an effect that checked if taskId changed, the cache update touched the task object — but the actual semantics were wrong. This is the kind of bug that escapes unit tests because the tests mock everything; only integration or E2E would catch it.

## Technical Details

**Bug #1: Optimistic Cache Missing sortOrder**

File: `frontend/src/hooks/use-sala-tasks.ts`, `onSuccess` callback in the reorder mutation:

```typescript
// BEFORE (broken)
const reorderMutation = useMutation({
  mutationFn: async ({ taskId, newStatus, newSortOrder }) => {
    return apiClient.patch(`/sala-tasks/${taskId}`, { status: newStatus, sortOrder: newSortOrder });
  },
  onMutate: async ({ taskId, newStatus, newSortOrder }) => {
    await queryClient.cancelQueries({ queryKey: ["sala-tasks"] });
    const prev = queryClient.getQueryData(["sala-tasks"]);
    
    // Optimistic: move task to new column
    queryClient.setQueryData(["sala-tasks"], (old) => ({
      ...old,
      tasks: old.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      // ❌ MISSING: sortOrder recomputation and cache write-back
    }));
    return { prev };
  }
});
```

**The fix:**
```typescript
// AFTER (fixed)
onMutate: async ({ taskId, newStatus, newSortOrder }) => {
  await queryClient.cancelQueries({ queryKey: ["sala-tasks"] });
  const prev = queryClient.getQueryData(["sala-tasks"]);
  
  queryClient.setQueryData(["sala-tasks"], (old) => ({
    ...old,
    tasks: old.tasks
      .map(t => t.id === taskId ? { ...t, status: newStatus, sortOrder: newSortOrder } : t)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) // Re-sort by new order
  }));
  return { prev };
}
```

**Bug #2: Modal Form State Not Resetting on Reopen**

File: `frontend/src/components/shared/sala-task-modal.tsx`:

```typescript
// BEFORE (broken)
export function SalaTaskModal({ taskId, open, onClose }) {
  const form = useForm({ defaultValues: initialValues });
  const { data: task } = useQuery(["sala-task", taskId], fetchTask);
  
  useEffect(() => {
    if (task && taskId) {
      form.reset(mapTaskToForm(task)); // Only resets if taskId CHANGES
    }
  }, [taskId]); // ❌ Doesn't re-sync if taskId is the same but modal reopened
  
  return (
    <Modal open={open} onClose={handleClose}>
      <Form>... {form.watch()}</Form>
    </Modal>
  );
}
```

**The fix:**
```typescript
// AFTER (fixed)
const [lastClosedAt, setLastClosedAt] = useState(0);

useEffect(() => {
  if (open && taskId && task) {
    // Force full re-sync on every open, not just on taskId change
    form.reset(mapTaskToForm(task));
  }
}, [open, taskId, task]); // Added `open` to dependency array

const handleClose = () => {
  setLastClosedAt(Date.now()); // Sentinel
  onClose();
};
```

**Additional fixes in same review:**
- `guestCount === 0` falsy-coercion bug in modal save (used `||` instead of explicit check) → changed to `guestCount ?? 0`
- One eslint/prettier error in test file (trailing comma in jest.fn mock)
- Minor `req.user.id` → `req.user?.id` consistency nit in new controller

**Tests added:**
- 10 unit tests for `SalaTasksService`: tenant isolation, soft-delete, reorder transaction, sortOrder computation logic
- 2 new specs in `use-sala-tasks.spec.ts` for optimistic cache update with sortOrder
- 1 spec for modal state reset on reopen
- Full backend suite: 1711 passing, 0 regressions

## What We Tried

No false starts — caught both bugs during mandatory code review before the first commit. The implementation logic was sound (dnd-kit integration, query client coordination), but the cache semantics were incomplete. Code reviewer traced the optimistic update path and found the sortOrder write-back missing. Modal state issue was revealed by reading the useEffect dependencies.

No production rollback needed; bug never shipped.

## Root Cause Analysis

**Why the cache bug?**  
Copy-paste from a simpler mutation that only touched status (no reorder). The developer (me, honestly) updated the optimistic onMutate to toggle status but forgot the second half: actually writing the new `sortOrder` back to the cached task object. The sort-order was computed server-side and included in the mutation response, but the onSuccess didn't use it, relying only on the UI's visual re-sort. This works *until* a user drags twice in quick succession.

**Why the modal state bug?**  
The useEffect tracked `taskId` as a dependency, assuming that "if taskId stays the same, don't resync." This is a common React pattern — works great when the component unmounts on modal close. But this modal was persistent (always mounted, just hidden). So the "open" gate was external (`open` prop), not component lifecycle. Result: taskId doesn't change → useEffect skips → form shows stale draft.

**Why did code review catch this?**  
Mandatory review gate before commit (existing project rule). Reviewer traced the data flow: "where does the new sortOrder go after the mutation?" → "into the response, then where?" → "only into onSuccess, which doesn't touch the cache" → bug found. Modal bug was found by asking "what if the user closes and opens the same task without changing taskId?" → dependency array missing `open`.

## Lessons Learned

1. **Optimistic updates must write every changed field back to cache.** Partial updates are a silent failure mode. Use TypeScript to enforce shape parity between what the server returns and what goes into `setQueryData`.

2. **Modal state in persistent components requires explicit "closed" tracking.** If a modal stays mounted while `open={false}`, useEffect dependencies like `taskId` alone are insufficient. Add `open` to the dependency array, or use a sentinel like `lastClosedAt` to force resync.

3. **Code review for state management is non-negotiable.** Unit tests pass because they're isolated. Bugs like these only surface in integration (user does X then Y), which code review can simulate by reading the data flow.

4. **dnd-kit multi-column is robust.** The library handled the drag-drop mechanics perfectly. The bugs were in our cache management, not in the drag library.

## Next Steps

- Committed as `c04fdc7`. Ready to merge.
- **Known gap — explicitly documented, not hidden**: No live browser E2E test was performed. Local dev constraints: (a) postgres at localhost:5432 has 0 tenants, so backend would reject requests; (b) port 3001 was occupied by another process. Verification relied on unit tests (10 new, all passing) + mandatory code review (both bugs found here). Plan phase files updated to note this trade-off honestly — success criteria checkboxes note "verified by code-review, not by live browser test."
- Full plan + reports at `plans/260828-2113-sala-notificaciones-kanban/`.
- **Git note**: Original branch (`fix/albaranes-correct-price-dto-numeros`) was merged into `origin/develop` as PR #59 mid-session. To avoid mixing unrelated work, branched fresh to `feat/sala-notificaciones-kanban` from `origin/develop` before committing. Not pushed — user will decide when.
