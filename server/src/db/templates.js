// Versioned templates on the server — the MCP endpoint's half of what
// app/db/templates.js does on a device. The rules (which version is in force,
// which template a line names, the next label) are @dotbook/core/templates; this
// file only stores and reads. Writes go through publish/publishUpdate so they sync.

import { findTemplateUse, nextLabel, resolveVersion } from "@dotbook/core/templates"
import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"

export function templates(db) {
	return db.all("SELECT * FROM templates WHERE deleted_at IS NULL ORDER BY name")
}

/** Newest first, so `versions[0]` is the latest label. `contents` comes back parsed. */
export async function versionsOf(db, templateId) {
	const rows = await db.all(
		"SELECT * FROM template_versions WHERE template_id = ? ORDER BY effective_from DESC, created_at DESC",
		[templateId]
	)
	return rows.map((row) => ({ ...row, contents: JSON.parse(row.contents) }))
}

/** Every live template with its versions and the one in force on `day`. */
export async function templatesOn(db, day) {
	const rows = await templates(db)
	return Promise.all(
		rows.map(async (template) => {
			const versions = await versionsOf(db, template.id)
			return { ...template, versions, current: resolveVersion(versions, day) }
		})
	)
}

/** `name` is unique for good — a removed template still holds its name. */
export async function createTemplate(db, groupId, { name, label, effectiveFrom, contents }) {
	const trimmed = name.trim()
	if (await db.get("SELECT 1 FROM templates WHERE name = ?", [trimmed])) {
		throw new Error(`A template named "${trimmed}" already exists — add a version to it instead.`)
	}
	const id = uuidv7()
	await publish(db, groupId, "templates", [{ id, name: trimmed, created_at: Date.now(), deleted_at: null }])
	await addVersion(db, groupId, id, { label, effectiveFrom, contents })
	return id
}

/** `label` defaults to what the app's form offers: the one after the latest (`1.3` → `1.4`), `1.0` for the first. */
export async function addVersion(db, groupId, templateId, { label = null, effectiveFrom, contents }) {
	const template = await db.get("SELECT 1 FROM templates WHERE id = ? AND deleted_at IS NULL", [templateId])
	if (!template) {
		throw new Error(`No template with id ${templateId}.`)
	}
	const [latest] = await versionsOf(db, templateId)
	const id = uuidv7()
	await publish(db, groupId, "template_versions", [
		{
			id,
			template_id: templateId,
			label: (label ?? (latest ? nextLabel(latest.label) : "1.0")).trim(),
			effective_from: effectiveFrom,
			contents: JSON.stringify(contents),
			created_at: Date.now(),
		},
	])
	return id
}

/**
 * Rule 1: logging snapshots — app/db/templates.js `recordUse`, step for step.
 * The version in force on the line's own day is copied onto it, so editing the
 * version later never changes what the line says. Called on every add and edit.
 */
export async function recordUse(db, groupId, { id, day, body }) {
	const all = await templates(db)
	const name = findTemplateUse(
		body,
		all.map((template) => template.name)
	)
	const template = all.find((candidate) => candidate.name === name)
	const version = template ? resolveVersion(await versionsOf(db, template.id), day) : null
	const existing = await db.get("SELECT version_id FROM template_uses WHERE entry_id = ?", [id])

	if (!version) {
		// Local only, as on a device: template_uses has no deleted_at, so a line
		// that stops naming a template leaves a stale chip on other devices.
		await db.run("DELETE FROM template_uses WHERE entry_id = ?", [id])
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
		await publishUpdate(db, groupId, "template_uses", { entry_id: id }, use)
		return
	}
	await publish(db, groupId, "template_uses", [{ entry_id: id, ...use }])
}
