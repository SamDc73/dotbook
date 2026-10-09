// Input fields more than one tool takes. `.describe()` is the only documentation
// the model gets for an argument, so every field says what it wants.

import * as z from "zod/v4"

export const DAY = z.iso.date().describe("A calendar date, YYYY-MM-DD, in the server's timezone")

export const OPTIONAL_DAY = DAY.optional().describe("YYYY-MM-DD; today when left out")

export const FROM = z.iso.date().optional().describe("First day, YYYY-MM-DD; a week before `to` when left out")

export const TO = z.iso.date().optional().describe("Last day, YYYY-MM-DD, inclusive; today when left out")

export function idOf(what) {
	return z.string().min(1).describe(`The ${what}'s id, as a read tool returned it`)
}

/** `contents` of a template version: one item per string, as it would be logged. */
export const CONTENTS = z
	.array(z.string().min(1))
	.min(1)
	.describe('The items, one string each, e.g. ["caffeine 100mg", "l-theanine 200mg"]')

// Annotations are hints for the client's approval UI; they never change what runs.
export const READ_ONLY = { readOnlyHint: true, openWorldHint: false }
export const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
export const REMOVES = { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
