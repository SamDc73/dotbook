// @dotbook/core/habits — the rules every surface must agree on.
// Habit definitions and ticks live in the database (migration 9); the LLM
// classifier that proposes ticks lives on the server. This package only
// decides what a set of ticks means.

export { effectiveTick } from "./ticks.js"
