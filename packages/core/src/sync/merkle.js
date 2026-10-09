// Comparing two merkle tries. @actual-app/crdt's `diff` starts by comparing
// the tries' `hash` fields — and a trie that never held a message has none
// (`{}`, what a fresh device's clock carries) while the relay's empty trie is
// `{ hash: 0 }`. Compared as they are, two empty sides "diverge" at time zero
// forever and a first sync never converges. Every trie gets its hash first.

import { merkle } from "@actual-app/crdt"

/** The minute the two tries first differ, or null when they hold the same set. */
export function divergence(a, b) {
	return merkle.diff(withHash(a), withHash(b))
}

function withHash(trie) {
	return trie.hash === undefined ? { ...trie, hash: 0 } : trie
}
