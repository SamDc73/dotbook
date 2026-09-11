import {
	applyDeviation,
	findTemplateUse,
	nextLabel,
	promotionCandidate,
	resolveVersion,
	sameDeviation,
} from "@dotbook/core/templates"
import { uuidv7 } from "uuidv7"
import { insertRow, updateRow } from "./sync"

// Versioned templates: rows in, rows out. `contents`, `snapshot` and `deviation`
// are JSON text in SQLite; they are parsed here, once, so screens see arrays/objects.
// Writes go through insertRow/updateRow (db/sync.js) so every device agrees.

export function templates(db) {
	return db.sql`SELECT * FROM templates WHERE deleted_at IS NULL ORDER BY name`
}

// Newest first, so `versions[0]` is the latest label.
export async function versionsOf(db, templateId) {
	const rows = await db.sql`SELECT * FROM template_versions WHERE template_id = ${templateId}
		ORDER BY effective_from DESC, created_at DESC`
	return rows.map((row) => ({ ...row, contents: JSON.parse(row.contents) }))
}

export async function createTemplate(db, { name, label, effectiveFrom, contents }) {
	const id = uuidv7()
	await insertRow(db, "templates", { id, name: name.trim(), created_at: Date.now(), deleted_at: null })
	await addVersion(db, id, { label, effectiveFrom, contents })
	return id
}

export async function addVersion(db, templateId, { label, effectiveFrom, contents }) {
	const id = uuidv7()
	await insertRow(db, "template_versions", {
		id,
		template_id: templateId,
		label: label.trim(),
		effective_from: effectiveFrom,
		contents: JSON.stringify(contents),
		created_at: Date.now(),
	})
	return id
}

// Rule 1: logging snapshots. The version in force on the entry's own day is
// copied onto the entry, so editing the version later never changes what the
// entry says. Called on every add and edit of a line.
export async function recordUse(db, { id, day, body }) {
	const all = await templates(db)
	const name = findTemplateUse(
		body,
		all.map((template) => template.name)
	)
	const template = all.find((candidate) => candidate.name === name)
	const version = template ? resolveVersion(await versionsOf(db, template.id), day) : null
	const existing = await db.sql`SELECT version_id FROM template_uses WHERE entry_id = ${id}`.first()

	if (!version) {
		// Local only: template_uses has no deleted_at, so this rare edit (a line
		// that stops naming a template) leaves a stale chip on other devices.
		await db.sql`DELETE FROM template_uses WHERE entry_id = ${id}`
		return
	}
	// Same version as before: keep the existing snapshot and deviation — they are history.
	if (existing?.version_id === version.id) {
		return
	}
	const use = {
		template_id: template.id,
		version_id: version.id,
		snapshot: JSON.stringify(version.contents),
		deviation: null,
	}
	if (existing) {
		await updateRow(db, "template_uses", { entry_id: id }, use)
		return
	}
	await insertRow(db, "template_uses", { entry_id: id, ...use })
}

// Rule 2: an edit is a deviation on this entry alone. The version is untouched.
export function saveDeviation(db, entryId, deviation) {
	const json = deviation ? JSON.stringify(deviation) : null
	return updateRow(db, "template_uses", { entry_id: entryId }, { deviation: json })
}

// The last uses of one template, newest first — the window the promotion rule counts over.
export function recentUses(db, templateId, limit) {
	return db.sql`SELECT u.entry_id AS entryId, e.day, u.deviation
		FROM template_uses u JOIN entries e ON e.id = u.entry_id
		WHERE u.template_id = ${templateId} AND e.deleted_at IS NULL
		ORDER BY e.day DESC, e.seq DESC LIMIT ${limit}`
}

export function prompts(db, templateId) {
	return db.sql`SELECT deviation FROM template_prompts WHERE template_id = ${templateId}`
}

// Everything the templates screen shows, per template: versions (newest first),
// the version in force on `day`, and the one question worth asking, if any.
export async function overview(db, day) {
	const rows = await templates(db)
	return Promise.all(
		rows.map(async (template) => {
			const versions = await versionsOf(db, template.id)
			const uses = await recentUses(db, template.id, 5)
			const candidate = promotionCandidate(uses, await prompts(db, template.id))
			return { ...template, versions, current: resolveVersion(versions, day), candidate }
		})
	)
}

// Rule 3, accepted: a new version from the first day of the deviation. The
// deviating entries are relabelled to it — their snapshots do not move.
export async function promote(db, template, candidate) {
	const base = resolveVersion(template.versions, candidate.effectiveFrom)
	const versionId = await addVersion(db, template.id, {
		label: nextLabel(template.versions[0].label),
		effectiveFrom: candidate.effectiveFrom,
		contents: applyDeviation(base.contents, candidate.deviation),
	})
	const uses = await recentUses(db, template.id, 5)
	for (const use of uses) {
		if (sameDeviation(JSON.parse(use.deviation), candidate.deviation)) {
			await updateRow(db, "template_uses", { entry_id: use.entryId }, { version_id: versionId })
		}
	}
	await answer(db, template.id, candidate.deviation, "promoted")
}

// Rule 3, declined: remembered forever, so this deviation is never asked about again.
export function decline(db, template, candidate) {
	return answer(db, template.id, candidate.deviation, "declined")
}

function answer(db, templateId, deviation, verdict) {
	return insertRow(db, "template_prompts", {
		id: uuidv7(),
		template_id: templateId,
		deviation: JSON.stringify(deviation),
		answer: verdict,
		answered_at: Date.now(),
	})
}
