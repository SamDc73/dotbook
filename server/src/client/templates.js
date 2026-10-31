// The web client's templates API — the HTTP half of app/db/templates.js: the
// templates screen's reads (versions, the version in force, the one question
// worth asking) and the rules' writes. Version rules, deviations, and the
// promotion question are @dotbook/core/templates; writes go through
// publish/publishUpdate so every device agrees.

import { applyDeviation, nextLabel, promotionCandidate, resolveVersion, sameDeviation } from "@dotbook/core/templates"
import { uuidv7 } from "uuidv7"
import { addVersion, templates as allTemplates, createTemplate, versionsOf } from "../db/templates.js"
import { publish, publishUpdate } from "../sync/publish.js"
import { today } from "../wallClock.js"

// The window the promotion rule counts over — app/db/templates.js's number.
const RECENT_USES = 5
const DAY = /^\d{4}-\d{2}-\d{2}$/

export function templates(app) {
	// Everything the templates screen shows, per template.
	app.get("/api/v1/templates", async (c) => {
		return c.json({ items: await overview(c.get("db"), today()) })
	})

	// A template is born with its first version, in force from the form's day (today unless changed).
	app.post("/api/v1/templates", async (c) => {
		const { name, contents, label, effectiveFrom = today() } = await body(c)
		const checked = checkContents(contents)
		if (typeof name !== "string" || name.trim() === "" || checked.error) {
			return c.json({ error: checked.error ?? "expected { name, contents: string[] }" }, 400)
		}
		if (!DAY.test(effectiveFrom)) {
			return c.json({ error: "effectiveFrom is 'YYYY-MM-DD'" }, 400)
		}
		const { db, groupId } = mine(c)
		const id = await createTemplate(db, groupId, { name, label: label ?? null, effectiveFrom, contents })
		return c.json({ template: await db.get("SELECT * FROM templates WHERE id = ?", [id]) }, 201)
	})

	app.post("/api/v1/templates/:id/versions", async (c) => {
		const { contents, label, effectiveFrom = today() } = await body(c)
		const checked = checkContents(contents)
		if (checked.error) {
			return c.json({ error: checked.error }, 400)
		}
		if (!DAY.test(effectiveFrom)) {
			return c.json({ error: "effectiveFrom is 'YYYY-MM-DD'" }, 400)
		}
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await liveRow(db, id))) {
			return c.json({ error: `no template with id ${id}` }, 404)
		}
		const versionId = await addVersion(db, groupId, id, { label: label ?? null, effectiveFrom, contents })
		return c.json({ version: await db.get("SELECT * FROM template_versions WHERE id = ?", [versionId]) }, 201)
	})

	// Rule 3, accepted: the repeated deviation becomes a version.
	app.post("/api/v1/templates/:id/promote", async (c) => {
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		const template = await liveTemplate(db, id)
		if (!template) {
			return c.json({ error: `no template with id ${id}` }, 404)
		}
		const candidate = await candidateFor(db, id)
		if (!candidate) {
			return c.json({ error: "no deviation repeated enough of the last uses to promote" }, 409)
		}
		await promote(db, groupId, template, candidate)
		return c.body(null, 204)
	})

	// Rule 3, declined: remembered forever, so this deviation is never asked again.
	app.post("/api/v1/templates/:id/decline", async (c) => {
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await liveRow(db, id))) {
			return c.json({ error: `no template with id ${id}` }, 404)
		}
		const candidate = await candidateFor(db, id)
		if (!candidate) {
			return c.json({ error: "no deviation repeated enough of the last uses to answer" }, 409)
		}
		await answer(db, groupId, id, candidate.deviation, "declined")
		return c.body(null, 204)
	})

	// Rule 2: an edit is a deviation on this entry alone — the version is
	// untouched. `changes` is the deviation (added / removed / changed) or null
	// to clear it.
	app.post("/api/v1/deviations", async (c) => {
		const { useId, changes } = await body(c)
		if (typeof useId !== "string" || typeof changes !== "object") {
			return c.json({ error: "expected { useId, changes }" }, 400)
		}
		const { db, groupId } = mine(c)
		if (!(await db.get("SELECT 1 FROM template_uses WHERE entry_id = ?", [useId]))) {
			return c.json({ error: `no template use for entry ${useId}` }, 404)
		}
		const deviation = changes ?? null
		await publishUpdate(
			db,
			groupId,
			"template_uses",
			{ entry_id: useId },
			{
				deviation: deviation ? JSON.stringify(deviation) : null,
			}
		)
		return c.body(null, 204)
	})
}

/** The auth'd caller's database and sync group. */
function mine(c) {
	return { db: c.get("db"), groupId: c.get("auth").user.id }
}

async function body(c) {
	return c.req.json().catch(() => ({}))
}

async function liveRow(db, id) {
	return db.get("SELECT 1 FROM templates WHERE id = ? AND deleted_at IS NULL", [id])
}

/** The template with its versions, newest first — what promote reads. */
async function liveTemplate(db, id) {
	const row = await db.get("SELECT * FROM templates WHERE id = ? AND deleted_at IS NULL", [id])
	if (!row) {
		return null
	}
	return { ...row, versions: await versionsOf(db, id) }
}

function checkContents(contents) {
	if (!Array.isArray(contents) || !contents.every((item) => typeof item === "string")) {
		return { error: "contents is a list of item strings" }
	}
	return {}
}

// The last uses of one template, newest first — the window the promotion rule
// counts over (app/db/templates.js `recentUses`).
function recentUses(db, templateId, limit) {
	return db.all(
		`SELECT u.entry_id AS entryId, e.day, u.deviation
		FROM template_uses u JOIN entries e ON e.id = u.entry_id
		WHERE u.template_id = ? AND e.deleted_at IS NULL
		ORDER BY e.day DESC, e.seq DESC LIMIT ?`,
		[templateId, limit]
	)
}

function prompts(db, templateId) {
	return db.all("SELECT deviation FROM template_prompts WHERE template_id = ?", [templateId])
}

// Everything the templates screen shows, per template — app/db/templates.js
// `overview`: versions (newest first), the version in force on `day`, and the
// one question worth asking, if any.
async function overview(db, day) {
	const rows = await allTemplates(db)
	return Promise.all(
		rows.map(async (template) => {
			const versions = await versionsOf(db, template.id)
			const candidate = await candidateFor(db, template.id)
			return { ...template, versions, current: resolveVersion(versions, day), candidate }
		})
	)
}

async function candidateFor(db, templateId) {
	return promotionCandidate(await recentUses(db, templateId, RECENT_USES), await prompts(db, templateId))
}

// Rule 3, accepted — app/db/templates.js `promote`: a new version from the
// first day of the deviation, the deviating uses relabelled to it (their
// snapshots do not move), and the question remembered as answered.
async function promote(db, groupId, template, candidate) {
	const base = resolveVersion(template.versions, candidate.effectiveFrom)
	const versionId = await addVersion(db, groupId, template.id, {
		label: nextLabel(template.versions[0].label),
		effectiveFrom: candidate.effectiveFrom,
		contents: applyDeviation(base.contents, candidate.deviation),
	})
	for (const use of await recentUses(db, template.id, RECENT_USES)) {
		if (sameDeviation(JSON.parse(use.deviation), candidate.deviation)) {
			await publishUpdate(db, groupId, "template_uses", { entry_id: use.entryId }, { version_id: versionId })
		}
	}
	await answer(db, groupId, template.id, candidate.deviation, "promoted")
}

// A prompt row: the deviation, and what became of it.
function answer(db, groupId, templateId, deviation, verdict) {
	return publish(db, groupId, "template_prompts", [
		{
			id: uuidv7(),
			template_id: templateId,
			deviation: JSON.stringify(deviation),
			answer: verdict,
			answered_at: Date.now(),
		},
	])
}
