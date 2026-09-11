// Which tick counts for one habit on one day.
//
// A person's decision always beats the model's proposal (V0.1 → feature 6:
// "a manual tick always wins"), and among ticks of the same kind the newest
// wins. A soft-deleted tick is not a tick — that is how a manual tick is
// unticked, and how a superseded proposal steps aside.

/**
 * @param {{ by: "manual"|"llm", value: "kept"|"broken", created_at: number, deleted_at?: number|null }[]} ticks
 *   every tick for one habit on one day, in any order
 * @returns the winning tick, or null when nothing was decided or proposed
 */
export function effectiveTick(ticks) {
	const live = ticks.filter((tick) => !tick.deleted_at)
	const manual = newest(live.filter((tick) => tick.by === "manual"))
	if (manual) {
		return manual
	}
	return newest(live.filter((tick) => tick.by === "llm"))
}

function newest(ticks) {
	if (ticks.length === 0) {
		return null
	}
	return ticks.reduce((best, tick) => (tick.created_at > best.created_at ? tick : best))
}
