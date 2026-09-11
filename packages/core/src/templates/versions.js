// Which version of a template a line gets, and which template a line names.

/**
 * The version in force on `day`: the newest `effective_from` that is ≤ day.
 * Logging a past date therefore resolves that date's version, not today's —
 * that is the backfill rule, and it costs nothing because `effective_from`
 * is the only input.
 *
 * @param {{ effective_from: string, created_at?: number }[]} versions  one template's versions, any order
 * @param {string} day  YYYY-MM-DD
 * @returns the version row, or null when none had taken effect yet
 */
export function resolveVersion(versions, day) {
	const inForce = versions.filter((version) => version.effective_from <= day)
	if (inForce.length === 0) {
		return null
	}
	// A promotion can be backdated onto the same day an older version began.
	// When two versions start on one day, the one created later is the current one.
	inForce.sort((a, b) => a.effective_from.localeCompare(b.effective_from) || (a.created_at ?? 0) - (b.created_at ?? 0))
	return inForce.at(-1)
}

/**
 * The template a line refers to — `took nootstack` → `"nootstack"` — or null.
 * When several names appear, the longest wins (`big breakfast` over `breakfast`).
 *
 * @param {string} body  the line after its time prefix
 * @param {string[]} templateNames
 * @returns {string | null}
 */
export function findTemplateUse(body, templateNames) {
	const mentioned = templateNames.filter((name) => mentions(body, name))
	if (mentioned.length === 0) {
		return null
	}
	mentioned.sort((a, b) => b.length - a.length)
	return mentioned[0]
}

// Whole-word, case-insensitive. Explicit boundaries rather than `\b`, because
// `\b` fails around names that end in punctuation (`stack (am)`). English-only,
// so letters and digits are the only word characters that matter.
// This is the one place a looser match belongs: swap this body for
// `fuzzyBest(name, [body])` from parse/fuzzy.js once it lands.
function mentions(body, name) {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(body)
}

/** `"1.3"` → `"1.4"`, `"2"` → `"2.1"`. Nothing fancier. */
export function nextLabel(label) {
	const parts = label.split(".")
	if (parts.length === 1) {
		return `${label}.1`
	}
	parts[parts.length - 1] = String(Number(parts.at(-1)) + 1)
	return parts.join(".")
}
