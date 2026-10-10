// @dotbook/core/sync — the Actual Budget sync pattern over @actual-app/crdt.
//
// A write is a set of messages (one per column). Devices exchange messages
// through a relay that stores them opaquely; each device materialises the
// newest message per field into its tables. Append-only rows merge by set
// union, so there is nothing to conflict; the small mutable surface is
// per-field last-write-wins by hybrid logical clock — except a line's text,
// where both versions of a clash are kept (conflicts.js).
//
// Every platform hands these functions the same four-method adapter — the one
// abstraction in this package, because expo-sqlite and bun:sqlite differ. The
// methods MAY return promises: expo-sqlite's async API is the only one that
// works on the web without SharedArrayBuffer, so every function here awaits
// the adapter and returns a promise itself. A synchronous adapter (bun:sqlite)
// works unchanged — awaiting a plain value is a no-op.
//
// @typedef {object} SyncDb
// @property {(sql: string, params?: unknown[]) => { changes: number } | Promise<{ changes: number }>} run
// @property {(sql: string, params?: unknown[]) => object[] | Promise<object[]>} all
// @property {(sql: string, params?: unknown[]) => object | null | Promise<object | null>} get
// @property {<T>(fn: () => Promise<T>) => Promise<T>} transaction  runs async `fn` atomically and returns its result

export { applyMessages, rebuildFromMessages } from "./apply.js"
export { CONFLICT_SOURCE } from "./conflicts.js"
export { messagesForInsert, messagesForUpdate } from "./messages.js"
export { buildSyncRequest, receiveSyncResponse, sync } from "./protocol.js"
export { ensureRelayTables, relay } from "./relay.js"
export { rowKey, SYNCED } from "./tables.js"
