// Quantities in a line: `200mg caffeine`, `caffeine 200 mg`, `1.5L water`,
// `2 pills`, `10k steps`, and a bare number next to a word (`3 eggs`).

// Canonical unit ← every spelling accepted for it. Matching is case-insensitive.
const UNIT_ALIASES = {
	mg: ["mg"],
	g: ["g", "gram", "grams"],
	mcg: ["mcg", "µg", "ug"],
	kg: ["kg"],
	oz: ["oz"],
	lb: ["lb", "lbs"],
	ml: ["ml"],
	l: ["l", "liter", "liters", "litre", "litres"],
	tsp: ["tsp"],
	tbsp: ["tbsp"],
	cup: ["cup", "cups"],
	shot: ["shot", "shots"],
	scoop: ["scoop", "scoops"],
	drop: ["drop", "drops"],
	iu: ["iu"],
	mmol: ["mmol"],
	pill: ["pill", "pills"],
	tab: ["tab", "tabs", "tablet", "tablets"],
	cap: ["cap", "caps", "capsule", "capsules"],
	serving: ["serving", "servings"],
	step: ["step", "steps"],
	kcal: ["kcal", "cal", "calories"],
	km: ["km"],
	mi: ["mi", "mile", "miles"],
	rep: ["rep", "reps"],
	set: ["set", "sets"],
	min: ["min", "mins", "minute", "minutes"],
	h: ["h", "hr", "hrs", "hour", "hours"],
}

const UNIT_BY_ALIAS = new Map(Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((a) => [a, unit])))

// Time units are durations (duration.js), never quantities.
const TIME_UNITS = new Set(["min", "h"])

// Words that are never the name of a thing. `of` is handled separately: `2 cups of coffee`.
const STOPWORDS = new Set(["with", "and", "at", "for", "in", "on", "to", "the", "a", "an", "from", "then", "w"])
// Common log verbs, so `took 2 pills` does not name the pills "took".
const VERBS = new Set(["took", "take", "had", "have", "ate", "eat", "drank", "drink", "did", "do", "got", "get"])

// A quantity, piece by piece:
//   before    start of text, or one char that is not a letter/digit and not part of
//             a time (`7:36`), a decimal, a tag (`#2`), a mention (`@3`) or a date/range (`-`)
//   number    `200`, `1.5`
//   thousands `10k` — only when the k is followed by a space or the end (`10km` is km)
//   space     whether a space sits between number and word
//   word      the unit or the next word, if any
const BEFORE = String.raw`(^|[^\w:.#@-])`
const NUMBER = String.raw`(\d+(?:\.\d+)?)(?![:.]\d)`
const THOUSANDS = String.raw`(k(?=\s|$))?`
const WORD = String.raw`(?:(\s?)([a-zA-Zµ]+))?`
const QUANTITY = new RegExp(`${BEFORE}${NUMBER}${THOUSANDS}${WORD}`, "gi")

const NAME_AFTER = /^\s*(?:of\s+)?([a-zA-Zµ][\w'-]*)/
const NAME_BEFORE = /([a-zA-Zµ][\w'-]*)\s*$/

/**
 * @param {string} body  the line after its time prefix
 * @returns {Array<{ name: string, qty: number, unit: string|null, extractor: "quantity", confidence: number }>}
 */
export function extractQuantities(body) {
	const items = []
	QUANTITY.lastIndex = 0
	for (let match = QUANTITY.exec(body); match !== null; match = QUANTITY.exec(body)) {
		const [whole, before, numberText, thousands, space, word] = match
		const unit = word ? UNIT_BY_ALIAS.get(word.toLowerCase()) : undefined

		if (unit && TIME_UNITS.has(unit)) {
			continue
		}
		// `3x`, `30m`, `v2`: an unknown suffix glued to a number is not a quantity.
		if (word && !unit && !space) {
			continue
		}

		const numberStart = match.index + before.length
		const numberEnd = numberStart + numberText.length + (thousands ? 1 : 0)
		const textBefore = body.slice(0, numberStart)
		// A bare number's word is its name (`3 eggs`); a unit's name is the neighbour (`200mg caffeine`).
		const textAfter = unit ? body.slice(match.index + whole.length) : body.slice(numberEnd)

		const name = unit ? nameNear(textBefore, textAfter) || unit : nameNear(textBefore, textAfter)
		if (!name) {
			continue
		}

		items.push({
			name,
			qty: Number(numberText) * (thousands ? 1000 : 1),
			unit: unit ?? null,
			extractor: "quantity",
			confidence: unit ? 1 : 0.5,
		})
	}
	return items
}

/** The word right after the quantity, else the word right before it; null when both are filler. */
function nameNear(textBefore, textAfter) {
	const after = NAME_AFTER.exec(textAfter)?.[1].toLowerCase()
	if (after && !isFiller(after)) {
		return after
	}
	const before = NAME_BEFORE.exec(textBefore)?.[1].toLowerCase()
	if (before && !isFiller(before)) {
		return before
	}
	return null
}

function isFiller(word) {
	return STOPWORDS.has(word) || VERBS.has(word)
}
