// When a repeated deviation earns its one question. See V0.1 → "Promotion rules".
//
// Counted as occurrences, not consecutive days: travel, a skipped day, or a
// forgotten log must not reset the count. Asked once per deviation, ever —
// a declined prompt is remembered permanently, and after a promotion the same
// deviation is already in the new version, so its prompt row stops it too.

import { sameDeviation } from "./deviations.js"

/** The same deviation in this many of the last PROMOTION_WINDOW uses → ask. */
export const PROMOTION_THRESHOLD = 3
export const PROMOTION_WINDOW = 5

/**
 * @param {{ entryId: string, day: string, deviation: object | string | null }[]} recentUses
 *   one template's uses, newest first. `deviation` may be the JSON text straight from SQLite.
 * @param {{ deviation: object | string }[]} prompts
 *   that template's `template_prompts` rows — every deviation ever asked about, any answer
 * @returns {{ deviation: object, days: string[], effectiveFrom: string } | null}
 *   `deviation` is the newest wording (it carries the latest dose, so the prompt
 *   can pre-fill the answer); `effectiveFrom` is the first day it appeared.
 */
export function promotionCandidate(recentUses, prompts) {
	const recent = recentUses
		.slice(0, PROMOTION_WINDOW)
		.map((use) => ({ ...use, deviation: asObject(use.deviation) }))
		.filter((use) => use.deviation !== null)

	// Newest first, so the first use to reach the threshold is also the freshest wording.
	for (const use of recent) {
		const matching = recent.filter((other) => sameDeviation(other.deviation, use.deviation))
		if (matching.length < PROMOTION_THRESHOLD) {
			continue
		}
		// Two different deviations cannot both reach 3 of 5, so a remembered answer ends the search.
		const alreadyAsked = prompts.some((prompt) => sameDeviation(asObject(prompt.deviation), use.deviation))
		if (alreadyAsked) {
			return null
		}
		const days = matching.map((match) => match.day).sort()
		return { deviation: use.deviation, days, effectiveFrom: days[0] }
	}
	return null
}

/** SQLite hands back JSON text; in-memory callers hand back objects. Accept both. */
function asObject(deviation) {
	if (typeof deviation === "string") {
		return JSON.parse(deviation)
	}
	return deviation ?? null
}
