# Dotbook — Beyond V0.1

Everything deliberately deferred. Nothing here is committed to.

**How to use this file:** read it and mark each item. `[ ]` untouched · `[x]` yes,
I want this · `~~strikethrough~~` no, drop it permanently. Anything you mark gets
promoted into a versioned spec of its own.

Ordered by how much each would change the architecture if adopted — the further
down, the more it wants to be designed for early rather than bolted on.

---

## 0. "Let's plan tmr" — on hold, explicitly remembered

You asked for this and then parked it. Keeping it visible so it isn't lost.

Manual day planning **is** in V0.1 (feature 12): write `5:00 -> 6:00 lunch` as a
plan line, get a reminder at the mark. What's deferred is the *automatic* part.

- [ ] "Let's plan tomorrow" fills a day from your usual patterns, rather than you
      laying every block out by hand.
- [ ] Source of those patterns is the open question: RRULE rules you wrote
      (deterministic, predictable), or inferred from what you actually did on past
      similar days (smarter, occasionally wrong in annoying ways).
- [ ] Same principle as versioning should apply — propose, never silently fill.

Cheap to add later: it writes ordinary `plan` lines. Nothing in V0.1 needs to
anticipate it beyond the `kind` column that already exists.

## 1. Plugin / extension system — *the deferred centerpiece*

Put on hold, not cancelled. This was the #1 feature in the original research and
the main reason the stack is JavaScript. Deferring it is fine; **contradicting it
is not** — as long as V0.1 keeps connectors behind a narrow interface, this stays
cheap to add. If V0.1 hardcodes Firefox/RingConn ingestion deep into the server,
it gets expensive.

- [ ] **Tier 1 — Sandboxed JS plugins.** User-written connectors in a QuickJS
      sandbox (`quickjs-emscripten` on server/web, QuickJS JSI or isolated Hermes
      on Android). Figma's model. Explicitly *not* Obsidian's full-trust model —
      this is health data.
- [ ] **Permission manifest** prompted at install: data scopes (`sleep:read`,
      `observations:write:whoop.*`), allowed network hosts, capabilities
      (schedule, notify, secrets).
- [ ] **Connector kit**: OAuth2 helper (PKCE + bring-your-own-client-credentials,
      the Home Assistant pattern), encrypted token vault, incremental sync
      cursors, rate-limit-aware fetch, file importers (CSV/FIT/GPX/ZIP).
- [ ] **One artifact, two hosts** — the same plugin runs on the phone (standalone,
      Doze-limited polling) or the server (reliable schedules + webhooks).
- [ ] **Registry**, HACS/Obsidian mechanics: code stays in author repos, a PR adds
      an index entry, CI does manifest lint + forbidden-API scan, in-app store
      installs from GitHub releases. You host nothing.
- [ ] **Small, sacred API surface.** Logseq froze its plugin API mid-rewrite and
      the ecosystem left for Obsidian. Pick the surface once.
- [ ] License split: AGPL-3.0 core + server, **MIT** SDK/schemas/templates.

**Design constraint for V0.1:** every ingestion path (Firefox, UsageStats,
RingConn) should write through one internal `ingest(streamType, rows, source)`
function. That function is the future plugin API. Keeping it narrow now is the
whole cost of deferring this.

## 2. Public read/write API

- [ ] Authenticated REST ingestion — register a stream type with a schema, POST
      observations. The ActivityWatch model.
- [ ] Any-language push, no SDK. This is where Python quantified-self pipelines,
      one-off scripts, and external tools live.
- [ ] API keys with scopes.
- [ ] MCP endpoint so AI agents can read the life log as a first-class client.

Cheap to add once the internal `/api/v1/` surface from V0.1 exists — it is mostly
auth and rate limiting on top.

## 3. Health Connect

- [ ] Read sleep/HR/activity from Android's Health Connect.
- [ ] One native integration covers **Oura, Whoop, Fitbit, Samsung, and Garmin**
      offline, with no OAuth and no cloud polling.
- [ ] Garmin is the reason this matters most: its official API is business-only
      and the unofficial scraping route died in March 2026.
- [ ] Requires a Play health data declaration if ever distributed there.

Highest leverage-per-hour item in this file. Dropped from V0.1 only because
RingConn CSV import covers the immediate need.

## 4. On-device LLM

- [ ] `react-native-executorch` (`useLLM`) or `llama.rn` for classification with
      no server at all.
- [ ] Honest tradeoff: ~1GB model download, and 1B-class models are weakest at
      exactly the urges-vs-acted nuance that justifies using an LLM.
- [ ] Best framing: on-device as a *fallback* that proposes low-confidence ticks
      offline, which the server model re-runs and corrects on sync.

## 5. Voice & richer input

- [ ] `whisper.rn` as a transcription upgrade over the built-in recognizer —
      better accuracy, fully offline, ~150MB model. Basic voice input is in V0.1.
- [ ] Other languages. English only for now, by choice, not by enforcement.
- [ ] Todoist-style live chip highlighting in the input
      (`@expensify/react-native-live-markdown`, verified to accept a custom
      worklet parser).
- [ ] Quick Settings tile / hardware shortcut to open the log sheet.
- [ ] Android intents → free Tasker interop.

## 6. Analysis — N-of-1 causal inference

From `research/gemini-deep-research.md`. This is a genuine product thesis, not a
chart library, and it is the one item that argues for a Python service.

- [ ] Move past correlation. Bayesian Structural Time Series / CausalImpact to
      build a **synthetic counterfactual** — what your sleep *would* have been
      without the intervention.
- [ ] Automated washout periods between trials (pharmacokinetic half-life table)
      so week A's supplement doesn't contaminate week B's baseline.
- [ ] Change-point detection for unprompted "something shifted here" insights.
- [ ] "Ghost runner" UI — actual vs. counterfactual, with uncertainty bands drawn
      honestly rather than as a single confident line.
- [ ] Runs as a **separate Python service consuming the public API** (item 2), not
      embedded in the app. This is the clean reason to build item 2 first.

⚠️ Requires months of data before it says anything real. Worth designing the log
for now (it already is: append-only, timestamped, provenance-tagged), worth
building later.

## 7. Passive phenotyping

- [ ] ActivityWatch connector (local REST, zero auth) — screen/window time.
- [ ] Keystroke dynamics as a cognitive proxy.
- [ ] Voice biomarkers from the voice-note audio.

⚠️ Each is a meaningful privacy escalation. Opt-in per signal, never default-on.

## 8. Platform & distribution

- [ ] iOS (Expo makes this close to a recompile; the Android-native pieces —
      alarms, UsageStats — need iOS equivalents or graceful absence).
- [ ] End-to-end encryption. The relay already stores opaque blobs, so the door is
      open — but key management is the real work.
- [ ] Self-hosted F-Droid repo / Obtainium for app distribution.
- [ ] Multi-user, if this ever stops being just yours.

---

## Kept as reference

- `research/what_tools_to_use.txt` — the full stack deliberation and capability
  matrix. Read this before reopening any stack decision.
- `research/gemini-deep-research.md` — the causal-inference and phenotyping thesis
  behind item 6.
- `copied_repos/uhabits` — Loop Habit Tracker, for reminder-reliability and
  core/platform separation patterns.
- `copied_repos/web-prototype` — earlier Dotbook UI work (Today view, quick-log
  sheet, nootropic cards, trend chart, correlations). Port in V0.1 phase 6.
