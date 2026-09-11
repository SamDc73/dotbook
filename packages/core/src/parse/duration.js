// Durations in a line: `2h30m`, `for 45 min`, `45min`, `1.5h`, `2h30`.
// parse-duration turns the matched span into milliseconds; the regex only finds it.

import parseDuration from "parse-duration"

// An hour part: `2h`, `1.5 hrs`, `2 hours`. Not followed by a letter, so `2h30m` still splits.
const HOURS = String.raw`\d+(?:\.\d+)?\s?(?:h|hrs?|hours?)(?![a-zµ])`
// A minute part: `30m` (only glued — `5 m` could be metres), `45 min`, `10 minutes`. `30mg` is not minutes.
const MINUTES = String.raw`\d+(?:\.\d+)?(?:m|\s?(?:mins?|minutes?))(?![a-zµ])`
// `2h30` — minutes with no unit, right after the hours.
const BARE_MINUTES = String.raw`\d{1,2}(?![\w:.])`
// Same "not glued to a word, time, tag or date" guard as quantity.js.
const BEFORE = String.raw`(^|[^\w:.#@-])`
const DURATION = new RegExp(`${BEFORE}(${HOURS}(?:\\s?(?:${MINUTES}|${BARE_MINUTES}))?|${MINUTES})`, "gi")

const MS_PER_MINUTE = 60_000

/**
 * @param {string} body  the line after its time prefix
 * @returns {Array<{ name: "duration", qty: number, unit: "min", extractor: "duration", confidence: 1 }>}
 *   `qty` is whole-or-fractional minutes.
 */
export function extractDurations(body) {
	const items = []
	DURATION.lastIndex = 0
	for (let match = DURATION.exec(body); match !== null; match = DURATION.exec(body)) {
		const ms = parseDuration(match[2])
		if (ms === null) {
			continue
		}
		items.push({ name: "duration", qty: ms / MS_PER_MINUTE, unit: "min", extractor: "duration", confidence: 1 })
	}
	return items
}
