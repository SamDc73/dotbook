// @dotbook/core/sync — the Actual Budget sync pattern over @actual-app/crdt.
//
// A write is a set of messages (one per column). Devices exchange messages
// through a relay that stores them opaquely; each device materialises the
// newest message per field into its tables. Append-only rows merge by set
// union, so there is nothing to conflict; the small mutable surface is
// per-field last-write-wins by hybrid logical clock.
//
// Every platform hands these functions the same four-method adapter — the one
// abstraction in this package, because expo-sqlite and bun:sqlite differ:
//
// @typedef {object} SyncDb
// @property {(sql: string, params?: unknown[]) => { changes: number }} run
// @property {(sql: string, params?: unknown[]) => object[]} all
// @property {(sql: string, params?: unknown[]) => object | null} get
// @property {<T>(fn: () => T) => T} transaction  runs `fn` atomically and returns its result

export { applyMessages, rebuildFromMessages } from "./apply.js"
export { messagesForInsert, messagesForUpdate } from "./messages.js"
export { buildSyncRequest, receiveSyncResponse, sync } from "./protocol.js"
export { ensureRelayTables, relay } from "./relay.js"
export { rowKey, SYNCED } from "./tables.js"
