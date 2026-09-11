// What an entry actually contained, versus what its template version said.
//
// Items are plain strings — `creatine 5g`, `fish oil` — and an item's *name* is
// that string with any trailing quantity removed. Names are what get compared,
// never quantities: `creatine 5g` today and `creatine 5.5g` tomorrow are the
// same deviation. Exact-match clustering is the documented failure mode in
// recurring-transaction detection (a small amount change breaks the cluster and
// the pattern is never found), and V0.1 rules it out on purpose.

// A trailing quantity: whitespace, a number, then an optional unit, glued or spaced.
//   `creatine 5g`  `caffeine 100 mg`  `vitamin d 2000iu`  `magnesium 2 pills`
const TRAILING_QUANTITY = /\s+\d+(?:[.,]\d+)?\s*[a-zµ%]*$/i

/** `"Creatine 5.5g "` → `"creatine"`; `"fish oil"` → `"fish oil"`. */
export function itemName(item) {
	return normalise(item).replace(TRAILING_QUANTITY, "")
}

/** Trimmed, lower-case, single-spaced — the form two items are compared in. */
function normalise(item) {
	return item.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Map of name → item as written, in list order. */
function byName(items) {
	const map = new Map()
	for (const item of items) {
		map.set(itemName(item), item)
	}
	return map
}

/**
 * The difference between a snapshot and what the entry was edited to say.
 *
 * @param {string[]} snapshot  the version's items, copied at logging time
 * @param {string[]} edited    the items after the user edited the line
 * @returns {{ added: string[], removed: string[], changed: [string, string][] } | null}
 *   `changed` pairs an item whose name matches but whose text differs (a new
 *   dose). Null when nothing differs — a plain use, not a deviation.
 */
export function diffItems(snapshot, edited) {
	const before = byName(snapshot)
	const after = byName(edited)

	const added = []
	const removed = []
	const changed = []

	for (const [name, item] of before) {
		if (!after.has(name)) {
			removed.push(item)
		} else if (normalise(after.get(name)) !== normalise(item)) {
			changed.push([item, after.get(name)])
		}
	}
	for (const [name, item] of after) {
		if (!before.has(name)) {
			added.push(item)
		}
	}

	if (added.length === 0 && removed.length === 0 && changed.length === 0) {
		return null
	}
	return { added, removed, changed }
}

/**
 * The items an entry actually contains: its snapshot with the deviation applied.
 * Also the contents of a promoted version.
 *
 * @param {string[]} snapshot
 * @param {ReturnType<typeof diffItems>} deviation
 * @returns {string[]}
 */
export function applyDeviation(snapshot, deviation) {
	if (!deviation) {
		return [...snapshot]
	}
	const removed = new Set(deviation.removed.map(itemName))
	const changed = new Map(deviation.changed.map(([from, to]) => [itemName(from), to]))

	const kept = []
	for (const item of snapshot) {
		const name = itemName(item)
		if (removed.has(name)) {
			continue
		}
		kept.push(changed.has(name) ? changed.get(name) : item)
	}
	return [...kept, ...deviation.added]
}

/**
 * Whether two deviations are the same one, for counting repeats.
 * Compares the names involved, not the quantities — see the header comment.
 */
export function sameDeviation(a, b) {
	if (!a || !b) {
		return !a && !b
	}
	return (
		sameNames(a.added, b.added) &&
		sameNames(a.removed, b.removed) &&
		sameNames(
			a.changed.map(([from]) => from),
			b.changed.map(([from]) => from)
		)
	)
}

function sameNames(itemsA, itemsB) {
	const namesA = itemsA.map(itemName).sort()
	const namesB = itemsB.map(itemName).sort()
	return namesA.length === namesB.length && namesA.every((name, i) => name === namesB[i])
}
