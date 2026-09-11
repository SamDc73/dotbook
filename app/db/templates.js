import {
	applyDeviation,
	findTemplateUse,
	nextLabel,
	promotionCandidate,
	resolveVersion,
	sameDeviation,
} from "@dotbook/core/templates"
import { uuidv7 } from "uuidv7"

// Versioned templates: rows in, rows out. `contents`, `snapshot` and `deviation`
// are JSON text in SQLite; they are parsed here, once, so screens see arrays/objects.

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
	await db.sql`INSERT INTO templates (id, name, created_at) VALUES (${id}, ${name.trim()}, ${Date.now()})`
	await addVersion(db, id, { label, effectiveFrom, contents })
	return id
}

export async function addVersion(db, templateId, { label, effectiveFrom, contents }) {
	const id = uuidv7()
	await db.sql`INSERT INTO template_versions (id, template_id, label, effective_from, contents, created_at)
		VALUES (${id}, ${templateId}, ${label.trim()}, ${effectiveFrom}, ${JSON.stringify(contents)}, ${Date.now()})`
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

	if (!version) {
		await db.sql`DELETE FROM template_uses WHERE entry_id = ${id}`
		return
	}
	// Same version as before: keep the existing snapshot and deviation — they are history.
	const existing = await db.sql`SELECT version_id FROM template_uses WHERE entry_id = ${id}`.first()
	if (existing?.version_id === version.id) {
		return
	}
	await db.sql`INSERT OR REPLACE INTO template_uses (entry_id, template_id, version_id, snapshot, deviation)
		VALUES (${id}, ${template.id}, ${version.id}, ${JSON.stringify(version.contents)}, NULL)`
}

// Rule 2: an edit is a deviation on this entry alone. The version is untouched.
export async function saveDeviation(db, entryId, deviation) {
	const json = deviation ? JSON.stringify(deviation) : null
	await db.sql`UPDATE template_uses SET deviation = ${json} WHERE entry_id = ${entryId}`
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
			await db.sql`UPDATE template_uses SET version_id = ${versionId} WHERE entry_id = ${use.entryId}`
		}
	}
	await answer(db, template.id, candidate.deviation, "promoted")
}

// Rule 3, declined: remembered forever, so this deviation is never asked about again.
export function decline(db, template, candidate) {
	return answer(db, template.id, candidate.deviation, "declined")
}

function answer(db, templateId, deviation, verdict) {
	return db.sql`INSERT INTO template_prompts (id, template_id, deviation, answer, answered_at)
		VALUES (${uuidv7()}, ${templateId}, ${JSON.stringify(deviation)}, ${verdict}, ${Date.now()})`
}
