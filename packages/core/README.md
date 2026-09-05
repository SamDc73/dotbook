# @dotbook/core

Logic that must produce **identical results on phone, web, and server**.

Nothing here may import from Expo, React, the DOM, or Bun. Plain JavaScript only,
so the same file runs in Hermes, a browser, and Bun without a build step.

| Directory | Owns |
|---|---|
| `parse/` | quick-add pipeline — times, ranges, doses, durations, fuzzy entities |
| `templates/` | version resolution, snapshots, deviations, promotion rules |
| `recurrence/` | RRULE expansion |
| `habits/` | habit rule evaluation over entries |
| `sync/` | merge logic (vendored `@actual-app/crdt`) |

A phone and a server disagreeing about whether a habit ticked today is the worst
bug class in this app: silent, and it corrupts history. That is why this package
exists and why nothing in it may fork per platform.

JSDoc types are used here — and only here — because correctness across three
runtimes is worth the annotations.
