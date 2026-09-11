// `#tag` and `@context` anywhere in a line. Must follow a space or the start,
// so an e-mail address or `and/or#2` is left alone.

const TAG = /(?:^|\s)#([\w-]+)/g
const CONTEXT = /(?:^|\s)@([\w-]+)/g

/**
 * @param {string} body  the line after its time prefix
 * @returns {Array<{ name: string, qty: null, unit: null, extractor: "tag"|"context", confidence: 1 }>}
 */
export function extractTags(body) {
	const items = []
	for (const match of body.matchAll(TAG)) {
		items.push({ name: match[1].toLowerCase(), qty: null, unit: null, extractor: "tag", confidence: 1 })
	}
	for (const match of body.matchAll(CONTEXT)) {
		items.push({ name: match[1].toLowerCase(), qty: null, unit: null, extractor: "context", confidence: 1 })
	}
	return items
}
