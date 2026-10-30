import { api } from "../lib/api"
import { noteChange } from "../lib/changes"

// Web twin of db/templates.js: versioned templates, rows in, rows out. The
// `db` parameter is accepted and ignored; the server holds the rows and does
// the snapshot/deviation bookkeeping when a line is written. Every mutating
// call ends with noteChange().
//
// CONTRACT GAPS (do not invent data): the overview payload is only promised to
// carry versions/current/candidate — `recentUses` and `prompts` are read from
// it when present and empty otherwise, and `day` (which version is in force)
// is the server's to resolve.

// Everything the templates screen shows, per template: versions (newest
// first), the version in force, and the one question worth asking, if any.
export async function overview(_db, _day) {
	const data = await api("/api/v1/templates")
	return data.items ?? []
}

// The template rows themselves, as the native `templates()` query returns
// them — the items are a superset, so they are handed straight through.
export async function templates(_db) {
	const data = await api("/api/v1/templates")
	return data.items ?? []
}

// Newest first, so `versions[0]` is the latest label. From the overview payload
// — there is no per-template endpoint.
export async function versionsOf(db, templateId) {
	const items = await overview(db)
	return items.find((item) => item.id === templateId)?.versions ?? []
}

export async function createTemplate(_db, { name, label, effectiveFrom, contents }) {
	const data = await api("/api/v1/templates", {
		method: "POST",
		body: { name, contents, label, effectiveFrom },
	})
	noteChange()
	// The markdown import chains addVersion onto this id, so it must come back.
	return data.template?.id ?? null
}

export async function addVersion(_db, templateId, { label, effectiveFrom, contents }) {
	const data = await api(`/api/v1/templates/${templateId}/versions`, {
		method: "POST",
		body: { contents, label, effectiveFrom },
	})
	noteChange()
	return data.version?.id ?? null
}

// Rule 1: logging snapshots. The server records the use when a line is written
// or edited — the same rule, applied where the rows live.
export function recordUse(_db, _use) {
	return Promise.resolve()
}

// Rule 2: an edit is a deviation on this entry alone. The version is untouched.
export async function saveDeviation(_db, entryId, deviation) {
	await api("/api/v1/deviations", { method: "POST", body: { useId: entryId, changes: deviation } })
	noteChange()
}

// The last uses of one template, newest first. CONTRACT GAP: only available if
// the overview payload carries them; empty otherwise, never invented.
export async function recentUses(db, templateId, limit) {
	const items = await overview(db)
	return (items.find((item) => item.id === templateId)?.recentUses ?? []).slice(0, limit)
}

// CONTRACT GAP: same story — the prompts live in the overview payload or not
// at all.
export async function prompts(db, templateId) {
	const items = await overview(db)
	return items.find((item) => item.id === templateId)?.prompts ?? []
}

// Rule 3, accepted: a new version from the first day of the deviation. The
// deviating entries are relabelled to it — their snapshots do not move.
export async function promote(_db, template, candidate) {
	await api(`/api/v1/templates/${template.id}/promote`, {
		method: "POST",
		body: { deviation: candidate.deviation, effectiveFrom: candidate.effectiveFrom },
	})
	noteChange()
}

// Rule 3, declined: remembered forever, so this deviation is never asked about again.
export async function decline(_db, template, candidate) {
	await api(`/api/v1/templates/${template.id}/decline`, {
		method: "POST",
		body: { deviation: candidate.deviation },
	})
	noteChange()
}
