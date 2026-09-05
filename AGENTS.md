# Dotbook Development Guide

Instructions for AI agents and humans working in the Dotbook repository.

## What is Dotbook

A self-hosted day-to-day life tracker: nootropics, habits, meals, mood, recurring
events, and passive data (browser/app time, smart ring). It replaces a Logseq +
markdown workflow, and its whole reason to exist is **log once, retype nothing**.

Android-first, offline-first, privacy-first, self-hostable. The Android app works
forever with no server; the server unlocks sync, the web app, browser-time
ingestion, and LLM habit classification.

See `V0.1.md` for current scope and `FUTURE.md` for everything deliberately deferred.

## Stack (decided — see `research/what_tools_to_use.txt` for the reasoning)

| Layer | Choice |
|---|---|
| Language | **Plain JavaScript** — no TypeScript |
| Android | Expo (React Native), New Architecture |
| Web | React + Vite |
| Server | Bun |
| Storage | SQLite everywhere |
| Sync | vendored `@actual-app/crdt` (Actual Budget pattern) |
| LLM | TanStack AI on the server → Ollama / any adapter |
| Parsing | `chrono-node`, `parse-duration`, `uFuzzy` |
| Recurrence | `rrule-es` (**not** `rrule` — unmaintained) |
| Push | local exact alarms; UnifiedPush + ntfy for server-initiated |

Deliberately not used: TypeScript, Flutter, Kotlin-native, Python, Postgres, FCM.

## Commands

- App (Android): `cd app && bun run start`
- Web: `cd web && bun run dev`
- Server: `cd server && bun run dev`
- Lint: `biome check --write .`
- Test: `bun test`

## Critical Rules - DO NOT VIOLATE

- **Fix ONLY what is explicitly requested** - no additional "improvements" or optimizations without permission
- **Never assume existing code needs improvement** - code exists as-is for reasons that may not be immediately apparent
- **Always explain WHY before suggesting changes** - provide clear reasoning for any proposed improvements
- **Ask explicit permission before implementing ANY additional changes** - even after explaining the benefits
- **Respect "if it ain't broke, don't fix it"** - production stability trumps theoretical improvements
- **NEVER create mock data or simplified components** unless explicitly told to do so
- **NEVER replace existing complex components with simplified versions** - always fix the actual problem
- **ALWAYS work with the existing codebase** - do not create new simplified alternatives
- **ALWAYS find and fix the root cause** of issues instead of creating workarounds
- When debugging issues, focus on fixing the existing implementation, not replacing it
- When something doesn't work, debug and fix it - don't start over with a simple version
- **ALWAYS check existing patterns FIRST** - examine similar files before implementing new features to avoid import/pattern mismatches
- **NEVER create aliases or wrapper functions for backward compatibility** - If renaming is needed, update all usages directly. Don't leave dead code or multiple names for the same thing. One concept = one name throughout the codebase.
- **ALWAYS mark completed tasks with [x]** - immediately after completing a task in any markdown file, add [x] to mark it as done

## Conventions

- Write code that a junior dev can understand, and a senior dev can admire
- Simplicity > one liners; always go the easy, straightforward way
- Always try to achieve the goal with the least amount of changes as much as possible
- Keep files under 200 lines as much as possible, hard limit is 500; you're not allowed to write to a file if it's larger than that.
- **Prefer a maintained library over hand-written code.** Cutting-edge is acceptable; low star count is acceptable. Reinventing is not. Check `package.json` before adding.
- Keep the codebase DRY but avoid Bad DRY: share infrastructure, models, and cross-cutting concerns. Don't repeat business logic, algorithms, or complex computations
- **Module Independence > DRY** — duplicate simple logic rather than creating shared utilities that couple modules tightly
- **Follow modular monolithic architecture** — well-defined modules with clear boundaries
- **Plan for multi-tenancy from day one** — implement user identity early even if initially unused

### The one hard sharing rule

Anything that must produce **identical results on phone, web, and server** lives in
`packages/core/` and is imported by all three. Never fork it.

That means: merge/CRDT logic, recurrence expansion, quick-add parsing, template
expansion, habit rule evaluation. A phone and a server disagreeing about whether a
habit ticked today is the worst bug class in this app — it is silent and it corrupts
history.

### JavaScript / React

- Plain JavaScript. **No TypeScript.** JSDoc types only in `packages/core/`, where correctness across surfaces matters
- Functional components only
- Absolute imports with `@/` prefix
- **NO plain CSS files** - Use Tailwind classes inline in JSX. Only exceptions: third-party library CSS
- **Component files**: PascalCase.jsx (Button.jsx, UserCard.jsx, ErrorBoundary.jsx)
- **Hook files**: use-hook-name.js (use-auth.js, use-toast.js)
- **Utilities/Services**: camelCase.js (apiClient.js, formatDate.js, authService.js)
- **Variables**: camelCase (userId, userName, isLoading)
- **Constants**: SCREAMING_SNAKE_CASE (MAX_RETRIES, API_TIMEOUT, DEFAULT_PAGE_SIZE)
- **Component props**: camelCase (onClick, isDisabled, hasError)
- **Think Reactively** - Identify primitives in this order:
  1. States (minimize these - only data that changes over time and triggers re-renders)
  2. Events (user interactions and their handlers)
  3. Computed values (derived from states during render, not stored)
  4. Refs (non-UI variables that need persistence across renders)
  5. Effects (last resort - only for external system sync)
- **Prevent React 19 render loops**: Always check if state has actually changed before calling setState
- **Don't trigger parent callbacks on mount**: Child components shouldn't call onChange during initial render
- **Be extremely careful with React Hook dependencies**: Objects and functions that change reference every render will cause infinite re-renders - validate that dependencies are stable
- **Use memoization when needed**: React 19 does NOT automatically optimize - use `useMemo()`, `useCallback()`, `memo()`
- Never ever use nested ternary statements
- `.jsx` for presentational layer, `.js` hooks for container layers

### Data & Storage

- SQLite everywhere — phone, web (OPFS), server. No Postgres.
- **Use UUIDv7 for all ids** — time-sortable, generated client-side so offline writes need no server round-trip
- **Store all timestamps as UTC epoch milliseconds.** Never naive local times. Keep the original timezone as a separate field when it matters
- **The observation log is append-only.** Corrections are new rows, never mutations. Soft-delete with `deleted_at`, never hard-delete — a hard delete cannot be synced
- Derived data (habit ticks, correlations, LLM classifications) is **always recomputable** from the log. Never let a derived value become the only copy of a fact
- Migration safety: one statement per call, explicit transactions, gate by schema version
- **Never generate fake data to satisfy a type or a chart.** Make the shape match reality — absent data renders as absent

### Sync

- Server is a dumb relay: it stores opaque messages and passes them around. It must never need to *understand* a message to route it
- Wrap `synchronize()` in a retry-once block
- Delta sync only, compressed
- Every row carries `source` (which device/connector produced it) — provenance is a feature, not debug info

### AI & LLMs

- **Use TanStack AI for all LLM calls** — one interface, swap Ollama / OpenAI / Anthropic / Groq by config
- **No model names or provider config in code** — all in environment variables
- **All prompts live in `server/src/ai/prompts.js`** — centralized regardless of file size
- LLM output is **always** a derived annotation, never the source of truth. Every classification stores the model, prompt version, and reasoning so it can be audited and re-run
- **Classification must never block logging.** It runs deferred, server-side, and backfills

### API (internal, for our own clients)

- RESTful naming: `/api/v1/resources` (plural for collections)
- ALL endpoints MUST use `/api/v1/` prefix
- Consistent response formats, proper HTTP status codes
- Implement pagination for list endpoints
- Always validate request bodies at the boundary
- Responses in camelCase

### Environment Variables

- **Server**: `server/.env`, read once into a config module — never scattered `process.env` calls
- **Web**: `VITE_` prefix
- **App**: `EXPO_PUBLIC_` prefix
- Never commit `.env`. Keep `.env.example` current

## Repo Layout

```
packages/core/       shared logic — merge, recurrence, parsing, habit rules
app/                 Expo Android app
web/                 React + Vite web app
server/              Bun server — relay, ingest, LLM classification
extension/           Firefox extension (browser time)
ringconn/            RingConn CSV samples + import mapping
research/            stack decision record and deep research (reference)
copied_repos/        reference code, not built or shipped
```
