// The one place request bodies are trusted. Each validator returns the clean
// body for `c.req.valid("json")`, or a 400 — everything after assumes the shape.

import { Timestamp } from "@actual-app/crdt"

const DAY = /^\d{4}-\d{2}-\d{2}$/
// Composite sync keys are joined with `|` (core/sync tables.js), so a device or
// site name carrying one would corrupt the key. Whitespace has no place in a host.
const KEY_PART = /^[^|\s]+$/
const MAX_ROLLUPS = 5000
const SECONDS_PER_DAY = 24 * 60 * 60

export function validateSyncBody(value, c) {
	const { groupId, clientId, merkle, messages } = value ?? {}
	const shapeOk =
		typeof groupId === "string" &&
		groupId !== "" &&
		/^[0-9a-f]{16}$/.test(clientId ?? "") &&
		typeof merkle === "object" &&
		merkle !== null &&
		Array.isArray(messages) &&
		messages.every(isMessage)
	if (!shapeOk) {
		return c.json({ error: "expected { groupId, clientId, merkle, messages[] }" }, 400)
	}
	return { groupId, clientId, merkle, messages }
}

function isMessage(message) {
	return (
		typeof message?.dataset === "string" &&
		typeof message.row === "string" &&
		typeof message.column === "string" &&
		"value" in message &&
		typeof message.timestamp === "string" &&
		Timestamp.parse(message.timestamp) !== null
	)
}

// V0.1 accepts only the Firefox extension here; Android app time arrives from
// the phone through sync, not through this endpoint.
export function validateBrowserTime(value, c) {
	const { source, device, rollups } = value ?? {}
	const shapeOk =
		source === "ext:firefox" &&
		typeof device === "string" &&
		KEY_PART.test(device) &&
		Array.isArray(rollups) &&
		rollups.length <= MAX_ROLLUPS &&
		rollups.every(isRollup)
	if (!shapeOk) {
		return c.json({ error: "expected { source: 'ext:firefox', device, rollups: [{ day, site, seconds }] }" }, 400)
	}
	return { source, device, rollups }
}

function isRollup(rollup) {
	return (
		DAY.test(rollup?.day ?? "") &&
		typeof rollup.site === "string" &&
		KEY_PART.test(rollup.site) &&
		Number.isInteger(rollup.seconds) &&
		rollup.seconds >= 0 &&
		rollup.seconds <= SECONDS_PER_DAY
	)
}

export function validateClassify(value, c) {
	const { day, all } = value ?? {}
	const shapeOk = (day === undefined || DAY.test(day)) && (all === undefined || typeof all === "boolean")
	if (!shapeOk) {
		return c.json({ error: "expected { day?: 'YYYY-MM-DD', all?: boolean }" }, 400)
	}
	return { day, all: all === true }
}
