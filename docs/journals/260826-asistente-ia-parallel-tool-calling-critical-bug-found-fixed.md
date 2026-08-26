# Asistente IA: Parallel Tool Calling Bug Found and Fixed Pre-Release

**Date**: 2026-08-26 20:44
**Severity**: Critical (would have broken production on any multi-tool response)
**Component**: AI Assistant (ai-assistant.service.ts, provider adapters)
**Status**: Resolved

## What Happened

Completed full 6-phase implementation of "Chefchek" AI assistant (natural-language business queries over tool-calling, never free-form SQL). Post-implementation code review found a **critical bug in parallel tool calling** that would have rendered the feature unusable the moment a user asked a question that triggered 2+ tools in a single LLM response — standard behavior for Gemini and Anthropic APIs, but our adapters broke on it. Bug was caught and fixed before any commit.

## The Brutal Truth

This is the kind of bug that passes initial testing because most single-tool queries work fine. It only surfaces under realistic multi-tool load — exactly what production would see immediately. The frustrating part: the bug wasn't in the orchestrator logic itself, but in how we normalized LLM responses back into the conversation history. We persisted a broken state to the database (orphaned tool-role messages creating invalid consecutive "user" turns), and because that state got persisted, *every subsequent message in that conversation* would replay the exact same 400 error from the provider with no recovery path. Silent corruption of a fresh conversation on the first multi-tool question.

## Technical Details

**Root Cause**: Gemini and Anthropic can return 2+ `tool_calls` in a single response (parallel execution). The orchestrator correctly executed each tool and pushed one `ChatMessage` per result with `role="tool"`. 

**The Break**: Both adapter implementations (`gemini-provider.adapter.ts`, `anthropic-provider.adapter.ts`) iterated the persisted messages and mapped each `role="tool"` message into its own separate "user"-role turn in the outbound payload. Result: two consecutive "user" turns instead of one grouped tool result → 400 `Invalid message structure` from both APIs.

**Impact**: The orchestrator caught nothing (it just got an error string), forwarded the raw error to the UI, *and persisted the broken conversation state to the database*. Next message in that conversation started from the same broken history → same 400 error, repeat forever. No graceful degradation, no recovery.

**The Fix**: Rewrote `buildMessages()` and `buildContents()` in both adapters to group consecutive `role="tool"` messages into a *single* turn per adapter, preserving the semantics of "here are all the tool results from the last LLM response."

**Tests Added**: 
- Regression specs in both `gemini-provider.adapter.spec.ts` and `anthropic-provider.adapter.spec.ts` covering 2-tool and 3-tool cases.
- One orchestrator-level test confirming the full loop with parallel tools.
- All existing 1671 backend tests still pass (+6 new).

## What We Tried

Didn't try anything broken — caught it in code review before the first real test. The issue was obvious once we traced the message structure through the adapter code path.

## Root Cause Analysis

The mistake: we built adapters against the OpenAI API first (which doesn't batch tool results the same way) and assumed both other APIs would follow suit. They don't. Neither of us ran even a manual smoke test with a 2-tool mock response before review. The adapters were written, tested in isolation with single-tool fixtures, and never validated against realistic multi-tool scenarios until the code reviewer traced the full path.

The design was sound (interface-driven adapters, tool registry separation) — the implementation was incomplete.

## Lessons Learned

1. **Mock the hard case first**: Multi-tool execution is not a edge case in LLM APIs, it's the default when a question is ambiguous or complex. Fixtures and specs should start with parallel calls, not single-tool "happy path."

2. **Trace persistence**: If you persist state based on an external API response, *immediately* test the unhappy path. Broken state in the database is worse than a clean error because it compounds on every retry.

3. **Tool-calling safety holds**: Despite this bug, the core security decision (no free-form SQL, server-side tenantId injection) never wavered and held up. Tool-calling as a pattern is correct for multi-tenant production data — the implementation just had to mature.

## Next Steps

- Committed (`d2a3eba`). No additional work needed — all issues from code review resolved.
- Manual end-to-end test with real OpenAI/Gemini/Anthropic API keys deferred to user (dev session had no live API credentials).
- One low-priority open: `AiAssistantConfigController` not gated by `@RequireModule("asistente-ia")` — user confirmed this is intentional (config can exist before module activation).

## Architecture Notes (Worked Well)

- **9 tools** (prices, purchases, recipes, stock) reuse existing services (PurchaseAnalyticsService, PriceAgreementService, etc.) — no new analytics engine built, low risk.
- **Provider adapters** abstracted behind a clean interface — swappable implementations (OpenAI, Gemini, Anthropic) without orchestrator coupling. Adapters use native fetch (Node ≥18), no SDK bloat.
- **Conversation persistence** (AssistantConversation/AssistantMessage models) separate from tool schema — clean separation of concerns.
- **30-message history window** (trimmed to safe boundary) + `updatedAt` bumped per-message prevents context-window blowup and keeps conversation list accurate.
- **Module gating** via existing `MODULE_REGISTRY` pattern (`defaultEnabled: true`) — consistent with infrastructure.
- **Throttle** (specific + strict on `/ai-assistant/ask`) caps LLM API spend per tenant.

**Backend test coverage**: 1671 tests, 106 suites, all passing.  
**Typecheck**: backend + frontend clean.  
**E2E smoke spec**: passing against real dev Postgres (module activation, no-config graceful degradation, tenant isolation).
