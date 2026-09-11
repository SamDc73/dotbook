// Everything a line's body yields, as `entry_items` rows minus id/entry_id.
// Runs over the text and annotates it; the text is never changed.

import { extractDurations } from "./duration.js"
import { extractQuantities } from "./quantity.js"
import { extractTags } from "./tags.js"

/**
 * @param {string} body  the line after its time prefix (`parseLineTime(...).body`)
 * @returns {Array<{ name: string, qty: number|null, unit: string|null, extractor: string, confidence: number }>}
 */
export function extractItems(body) {
	return [...extractQuantities(body), ...extractDurations(body), ...extractTags(body)]
}
