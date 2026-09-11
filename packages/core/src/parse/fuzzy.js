// The one fuzzy matcher the whole app shares: template names, `/` commands,
// todos, template deviations. Everything typo-tolerant goes through here so
// phone, web and server agree on what matches.

import uFuzzy from "@leeoniya/ufuzzy"

// intraMode 1 is uFuzzy's "single error" mode: one insertion, substitution,
// transposition or deletion inside a term (never its first character), so
// `brekfast` → breakfast and `creatien` → creatine. Plain prefixes still match
// with no error at all: `caff` → caffeine. Terms must appear in order.
const MATCHER = new uFuzzy({ intraMode: 1, intraIns: 1, intraSub: 1, intraTrn: 1, intraDel: 1 })

/**
 * @param {string} needle     what was typed
 * @param {string[]} haystack candidates
 * @param {{ outOfOrder?: boolean }} [options]  let the needle's words come in any order
 *   (uFuzzy tries the permutations, up to five words) — for a todo named by its words
 * @returns {{ index: number, ranked: number[] }}
 *   `ranked` is every matching haystack index, best first; `index` is the best
 *   one or -1. An empty needle matches everything in its original order.
 */
export function fuzzyFind(needle, haystack, { outOfOrder = false } = {}) {
	if (needle.trim() === "") {
		const all = haystack.map((_, i) => i)
		return { index: all.length ? 0 : -1, ranked: all }
	}

	const [idxs, info, order] = MATCHER.search(haystack, needle, outOfOrder ? 5 : 0)
	let ranked = []
	if (order) {
		ranked = order.map((i) => info.idx[i])
	} else if (idxs) {
		// Above uFuzzy's ranking threshold (1000 matches) only the filter runs.
		ranked = idxs
	}
	return { index: ranked.length ? ranked[0] : -1, ranked }
}

/** The best-matching candidate, or null. */
export function fuzzyBest(needle, haystack) {
	const { index } = fuzzyFind(needle, haystack)
	return index === -1 ? null : haystack[index]
}
