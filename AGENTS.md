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
| Android + Web | **One** Expo universal codebase (`app/`) — RN on Android, react-native-web on web |
| Server | Bun |
| Storage | SQLite everywhere |
| Sync | vendored `@actual-app/crdt` (Actual Budget pattern) |
| LLM | TanStack AI on the server → Ollama / any adapter |
| Parsing | `chrono-node`, `parse-duration`, `uFuzzy` |
| Recurrence | `rrule-es` (**not** `rrule` — unmaintained) |
| Push | `expo-notifications`; exact alarms need a small Kotlin module |
| Styling | NativeWind 5 (preview) + Tailwind 4, CSS-first |
| Design tokens | **Cyanotype & Verdigris** — M3 roles + golden-ratio scale |
| Components | `react-native-reusables` (shadcn for RN, copy-in) |
| Dynamic colour | Material You via `@pchmn/expo-material3-theme` |
| Icons | `lucide-react-native` |
| Voice | `expo-speech-recognition` (on-device, English) |

### Two setup traps — do not undo these

1. **NativeWind 5 + Tailwind 4 needs `@tailwindcss/postcss`.** Without
   `postcss.config.mjs`, `@theme` passes through uncompiled and **no utility
   classes are generated**. The build still succeeds. Silent failure.
2. **NativeWind 5 has no `jsx-runtime`.** Do not set
   `jsxImportSource: 'nativewind'` in `babel.config.js` — that is v4 syntax and
   the bundle fails to resolve. The `nativewind/babel` preset handles it.

NativeWind 4 + Tailwind 3.4 is the stable fallback if the preview causes trouble;
it was verified working here before switching to 4 on request.

Deliberately not used: TypeScript, Flutter, Kotlin-native, Python, Postgres, FCM.

### UI libraries evaluated and rejected — do not re-open without a reason

| Library | Why not |
|---|---|
| **HeroUI Native** | No web support — its own docs say so. Would require HeroUI React alongside it: two component libraries kept at parity, for an app whose point is that Android and web behave identically. Revisit only if web parity is ever dropped. |
| **React Native Paper** | The closest call. Polished MD3 components and the best-documented Material You path. Rejected because it carries its own theme object (duplicating `tokens.css`) and its web output looks like an Android app in a browser — bad for a text-heavy log used on a laptop. |
| **Tamagui** | Excellent tech, wrong fit for the goal. Another styling DSL, more config, and Material You is entirely manual. More thinking, not less. |
| **the design system components** | Next.js + real CSS. Cannot run on React Native. Its *tokens* were taken; its components were not. |

## Commands

- App (Android): `cd app && bun run android`
- Web: `cd app && bun run web` (same codebase)
- Server: `cd server && bun run dev`
- Verify the build pipeline: `cd app && bunx expo export --platform web`
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

### Design system — one source, no exceptions

**`app/theme/tokens.css` is the only place a design value may be defined.**

Never write a raw colour, spacing value, font size, or radius anywhere else. Not
in a component, not in a StyleSheet, not "just this once" for a one-off screen.
If you need a value that does not exist, add it to `tokens.css` first, then use
it as a utility class. This single rule is what makes the app feel like one
thing rather than twelve screens built on twelve afternoons.

```
❌ <View style={{ padding: 16, backgroundColor: '#635bff' }}>
❌ <View className="p-[16px] bg-[#635bff]">      // arbitrary values are the same sin
✅ <View className="p-md bg-primary">
```

#### The palette: Cyanotype & Verdigris

Settled. Four alternative proposals (Low Lamplight, Kelvin Drift, Materia Medica,
Iron Gall Ledger) were built and dropped — do not revive them.

| Role | Light | Dark | Carries |
|---|---|---|---|
| `primary` | `#006cb4` | `#78beff` | identity, actions, links, version chips |
| `success` | `#004746` | `#7be6e2` | habit kept, dose taken |
| `error` | `#e1595b` | `#d24c50` | habit broken, destructive |
| `warning` | `#905c00` | `#f2a635` | plan approaching, pending |
| `tertiary` | `#676292` | `#b4b0e5` | passive data — ring, screen time, anything untyped |

Neutrals are tinted toward hue 248 at chroma 0.006–0.016 — never pure grey.
`docs/palette.html` is the living reference: specimens, contrast, and a live
colour-vision simulator. Open it before changing any colour.

**`success` and `error` are separated by lightness, not hue — do not "fix" this.**
ΔL 0.28 in light, 0.26 in dark. It looks like an odd pairing (deep teal against a
light red) and it is deliberate: roughly one man in twelve has a red–green
deficiency, and dichromacy compresses hue while leaving luminance almost
untouched. An earlier draft used the same two hues at nearly equal lightness and
retained just **14%** of its separation under protanopia — worse than plain
green/red. Pulling them apart in lightness took deuteranopia to 84%.

Light-theme protanopia is still the weak cell at 48%, which is exactly why:

**Habit state is encoded by shape first, colour second.** Kept is a *filled*
ring, broken is a ring *struck through*, pending is a *dashed* ring, passive is a
*diamond*. Those four silhouettes are distinguishable with colour removed
entirely, and the word is printed beside each anyway. Never ship a state that
only colour distinguishes.

#### The hour drift

`--hour-00` … `--hour-23` tint a timestamp by the hour it names — warm at dawn
and dusk, colourless at noon, cool after midnight, off the Planckian and CIE
daylight loci.

The whole ramp lives at chroma **0.002–0.038** while every colour that *means*
something lives at **0.075–0.185**. Keep that gap. It is the only thing stopping
an hour being misread as a habit state, and it is why the drift reads as
atmosphere rather than decoration. Lightness is pinned across all 24 steps, so
the drift costs no contrast: the floor is 4.62:1 light, 6.52:1 dark.

Use it for timestamps and the log gutter. Nothing else.

**Colours are Material 3 roles, not hues.** Use `bg-primary`, `text-on-surface`,
`bg-error-container` — never `bg-blue-500`. Roles carry meaning, so they stay
correct when the palette changes and they get dark mode for free. Every role has
a matching `on-` pair; text on `bg-primary` is `text-on-primary`, always.

Semantic roles map to this app's domain: `success` = habit kept / dose taken,
`error` = habit broken / destructive, `warning` = plan approaching / needs review.

**Sizes come from the golden ratio.** `--spacing-*` and `--text-*` are φ-derived
(`text-title2` is φ² = 2.618rem). Reach for the next step on the scale rather than
inventing a number — that is the whole point of a ratio-based system.

**Re-hue the entire app by editing `tokens.css` alone.** If changing the palette
requires touching any other file, something has violated this rule.

#### Material You — why the rules above are what make it work

On Android 12+ the palette comes from the user's wallpaper at runtime via
`@pchmn/expo-material3-theme`. It works here for one reason: our colours are
already **M3 roles**, and that library generates its palette with Google's
official `@material/material-color-utilities` — the same role set. The OS output
maps onto our variable names 1:1 (camelCase → kebab-case).

How it fits together:

- `tokens.css` holds the **static fallback** — used on web, on iOS, and on
  Android below 12, where no system palette exists
- At runtime a provider converts the system theme to `vars()` and wraps the app
  with `VariableContextProvider` (both exported by NativeWind 5), overriding the
  same variable names
- `success` / `warning` / `info` stay static — they are the design system additions and M3
  does not generate them

**Never read a colour into JavaScript.** No `theme.colors.primary`, no passing
hex values as props, no `StyleSheet.create` with a colour in it. Use the utility
class and let the variable resolve. A component that reads a colour in JS is
frozen at the static value and will not follow the wallpaper — and that breakage
is invisible until someone changes their wallpaper.

#### Components

`react-native-reusables` — shadcn/ui for React Native. Components are **copied
into the repo**, not imported, so they are ours to edit. Every copied component
must be converted to token utilities before use; they ship with their own colour
defaults, and leaving those in place silently breaks both theming and Material You.

⚠️ RNR's support for the NativeWind 5 preview is unverified. If it fights the
preview, fall back to NativeWind 4 + Tailwind 3.4 (verified working here) rather
than abandoning the token system.

The golden-ratio spacing and type scale come from the design system
(`copied_repos/design-system-tailwind`); its colours do not. the design system builds its scale
with nested `calc(var(--…))` chains, which React Native cannot evaluate — ours
are those chains pre-computed to static values so phone and web agree exactly.
Its *components* are Next.js + real CSS and cannot run on React Native:
reference only, never import.

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
app/                 Expo universal — Android and web from one codebase
app/theme/tokens.css THE design tokens — colours, spacing, type, radius
docs/palette.html    palette reference — specimens, contrast, CVD simulator
server/              Bun server — relay, ingest, LLM classification
extension/           Firefox extension (browser time)
ringconn/            RingConn CSV samples + import mapping
copied_repos/        reference code, not built or shipped
```
