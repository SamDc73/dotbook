// Deferred habit classification. A finished day's log lines go to the model
// with the habit list; its verdicts come back as `llm` ticks, published through
// the relay so every device sees the proposals. Never on the logging path — a
// device syncs, and some minutes later a proposal may appear. Everything here
// is re-runnable: drop the run rows and history is classified again.

import { localDay } from "@dotbook/core/parse"
import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"
import { CLASSIFY_SYSTEM, classifyPrompt, PROMPT_VERSION } from "./prompts.js"

const VERDICTS = new Set(["kept", "broken", "unknown"])

/**
 * Classify one day. Returns how many ticks were published — 0 also when the
 * model's answer was unusable, in which case no run is recorded and the day
 * stays pending for the next pass.
 * @param {import("@dotbook/core/sync").SyncDb} db
 * @param {string} day  YYYY-MM-DD
 * @param {string} groupId
 * @param {import("./adapter.js").Classifier} classifier
 */
export async function classifyDay(db, day, groupId, classifier) {
	const habits = await activeHabits(db)
	const rows = await db.all(
		"SELECT text FROM entries WHERE day = ? AND kind = 'log' AND deleted_at IS NULL ORDER BY seq",
		[day]
	)
	const lines = rows.map((row) => row.text)
	if (habits.length === 0 || lines.length === 0) {
		return 0
	}

	const answer = await classifier.complete(CLASSIFY_SYSTEM, classifyPrompt(habits, lines))
	const verdicts = parseVerdicts(answer, habits)
	if (verdicts === null) {
		console.error(`classify ${day}: unusable answer from ${classifier.model}: ${String(answer).slice(0, 200)}`)
		return 0
	}

	// A run replaces the previous run's proposals wholesale: a habit the model
	// now calls "unknown" loses its old tick rather than keeping a stale one.
	for (const habit of habits) {
		await retireProposals(db, groupId, habit.id, day)
	}
	let published = 0
	for (const { habit, verdict, reasoning } of verdicts) {
		if (verdict === "unknown") {
			continue
		}
		await publish(db, groupId, "habit_ticks", [
			{
				id: uuidv7(),
				habit_id: habit.id,
				day,
				value: verdict,
				by: "llm",
				model: classifier.model,
				prompt_version: PROMPT_VERSION,
				reasoning,
				created_at: Date.now(),
				deleted_at: null,
			},
		])
		published++
	}
	await db.run("INSERT INTO classification_runs (id, day, model, prompt_version, created_at) VALUES (?, ?, ?, ?, ?)", [
		uuidv7(),
		day,
		classifier.model,
		PROMPT_VERSION,
		Date.now(),
	])
	return published
}

/**
 * Days still to classify with this model + prompt version, newest first.
 * Only finished days (before today): today's log is still being written, and
 * a day classified half-way would never be looked at again.
 */
export async function pendingDays(db, classifier, now = Date.now()) {
	if ((await activeHabits(db)).length === 0) {
		return []
	}
	const rows = await db.all(
		`SELECT DISTINCT day FROM entries
		WHERE kind = 'log' AND deleted_at IS NULL AND day < ?
		AND day NOT IN (SELECT day FROM classification_runs WHERE model = ? AND prompt_version = ?)
		ORDER BY day DESC`,
		[localDay(now), classifier.model, PROMPT_VERSION]
	)
	return rows.map((row) => row.day)
}

let running = false

/** Classify every pending day. Never throws; a failed day is logged and skipped. */
export async function runPending(db, groupId, classifier) {
	if (running) {
		return 0
	}
	running = true
	let done = 0
	try {
		for (const day of await pendingDays(db, classifier)) {
			try {
				await classifyDay(db, day, groupId, classifier)
				done++
			} catch (error) {
				console.error(`classify ${day} failed:`, error)
			}
		}
	} finally {
		running = false
	}
	return done
}

/** Forget every run for the current model + prompt version, so history re-runs. */
export async function clearRuns(db, classifier) {
	await db.run("DELETE FROM classification_runs WHERE model = ? AND prompt_version = ?", [
		classifier.model,
		PROMPT_VERSION,
	])
}

export async function classifyStatus(db, classifier) {
	const last = await db.get("SELECT max(created_at) AS at FROM classification_runs")
	return { pending: (await pendingDays(db, classifier)).length, lastRun: last?.at ?? null }
}

async function activeHabits(db) {
	return db.all("SELECT id, name, kind FROM habits WHERE deleted_at IS NULL ORDER BY name")
}

/** Soft-delete the model's earlier ticks for this habit and day. Manual ticks are never touched. */
async function retireProposals(db, groupId, habitId, day) {
	const rows = await db.all(
		"SELECT id FROM habit_ticks WHERE habit_id = ? AND day = ? AND by = 'llm' AND deleted_at IS NULL",
		[habitId, day]
	)
	for (const { id } of rows) {
		await publishUpdate(db, groupId, "habit_ticks", { id }, { deleted_at: Date.now() })
	}
}

/**
 * The model's answer as `[{ habit, verdict, reasoning }]`, or null when it is
 * not the shape the prompt asked for. Strict on shape; a code fence around the
 * JSON is tolerated because small local models add one despite instructions.
 * A verdict naming an unknown habit is dropped, a habit left out is "unknown".
 */
function parseVerdicts(answer, habits) {
	let parsed
	try {
		parsed = JSON.parse(String(answer).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""))
	} catch {
		return null
	}
	if (!Array.isArray(parsed?.verdicts)) {
		return null
	}
	const byName = new Map(habits.map((habit) => [habit.name.toLowerCase(), habit]))
	const verdicts = []
	for (const item of parsed.verdicts) {
		const habit = byName.get(String(item?.habit ?? "").toLowerCase())
		if (!habit || !VERDICTS.has(item.verdict)) {
			continue
		}
		verdicts.push({ habit, verdict: item.verdict, reasoning: String(item.reasoning ?? "") })
	}
	return verdicts
}
