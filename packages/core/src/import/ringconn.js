// RingConn CSV exports → observation rows. See ringconn/README.md for what the
// three files look like; every column name below was read off real exports.
//
// Timestamps in the files are naive local time — the phone's zone when the ring
// app exported, with no offset written anywhere. The caller says which zone
// that was; nothing here guesses.

import { TZDate } from "@date-fns/tz"
import Papa from "papaparse"

const SOURCE = "import:ringconn"

// The export type is read off the header, not the filename: Android's document
// picker hands over content:// URIs whose display name it may rewrite.
const HEADERS = {
	activity: "Date,Steps,Calories(kcal)",
	sleep:
		"Start Time,End Time,Falling Asleep Time,Wake-up time,Sleep Time Ratio(%),Time Asleep(min)," +
		"Sleep Stages - Awake(min),Sleep Stages - REM(min),Sleep Stages - Light Sleep(min),Sleep Stages - Deep Sleep(min)",
	vitals:
		"Date,Avg. Heart Rate(bpm),Min. Heart Rate(bpm),Max. Heart Rate(bpm),Avg. Spo2(%),Min. Spo2(%),Max. Spo2(%)," +
		"Avg. HRV(ms),Min. HRV(ms),Max. HRV(ms)",
}

// One line per export type: the table it lands in, its natural key (what makes
// a re-import idempotent), and CSV column → table column with its converter.
// This list drives the parsed row, the INSERT, and the parameter order, so the
// three can never disagree.
const TABLES = {
	activity: {
		table: "daily_activity",
		key: "day",
		columns: [
			["Date", "day", text],
			["Steps", "steps", integer],
			["Calories(kcal)", "kcal", integer],
		],
	},
	sleep: {
		table: "sleep_sessions",
		key: "start_ts",
		withId: true,
		columns: [
			["Start Time", "start_ts", instant],
			["End Time", "end_ts", instant],
			["Falling Asleep Time", "asleep_ts", instant],
			["Wake-up time", "wake_ts", instant],
			["Sleep Time Ratio(%)", "ratio", percent],
			["Time Asleep(min)", "asleep_min", integer],
			["Sleep Stages - Awake(min)", "awake_min", integer],
			["Sleep Stages - REM(min)", "rem_min", integer],
			["Sleep Stages - Light Sleep(min)", "light_min", integer],
			["Sleep Stages - Deep Sleep(min)", "deep_min", integer],
		],
	},
	vitals: {
		table: "daily_vitals",
		key: "day",
		columns: [
			["Date", "day", text],
			["Avg. Heart Rate(bpm)", "avg_hr", integer],
			["Min. Heart Rate(bpm)", "min_hr", integer],
			["Max. Heart Rate(bpm)", "max_hr", integer],
			["Avg. Spo2(%)", "avg_spo2", percent],
			["Min. Spo2(%)", "min_spo2", percent],
			["Max. Spo2(%)", "max_spo2", percent],
			["Avg. HRV(ms)", "avg_hrv", integer],
			["Min. HRV(ms)", "min_hrv", integer],
			["Max. HRV(ms)", "max_hrv", integer],
		],
	},
}

/**
 * Which RingConn export a file is, from its first line alone.
 * @param {string} headerLine
 * @returns {"activity" | "sleep" | "vitals" | null}
 */
export function detectRingconnFile(headerLine) {
	const header = headerLine.trim()
	for (const [kind, expected] of Object.entries(HEADERS)) {
		if (header === expected) {
			return kind
		}
	}
	return null
}

/**
 * Rows ready for `RINGCONN_UPSERT[kind]`, in file order.
 *
 * Skipped, never thrown: rows with a blank key, rows whose field count does not
 * match the header, and rows where every measurement is blank (the ring was not
 * worn — an absent observation is absent, not a row of nulls).
 *
 * @param {string} text  the whole file
 * @param {{ tzid: string }} options  the zone the naive timestamps were written in
 * @returns {{ kind: "activity" | "sleep" | "vitals" | null, rows: object[] }}
 */
export function parseRingconnCsv(text, { tzid }) {
	const kind = detectRingconnFile(text.slice(0, text.indexOf("\n")))
	if (kind === null) {
		return { kind, rows: [] }
	}

	// `transform` trims every cell: some exported rows end in CRLF while the
	// rest end in LF, so the last cell of those rows would otherwise be "\r".
	const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transform: (cell) => cell.trim() })
	const malformed = new Set(parsed.errors.map((error) => error.row))
	const { columns, key } = TABLES[kind]

	const rows = []
	parsed.data.forEach((record, index) => {
		if (malformed.has(index)) {
			return
		}
		const row = { source: SOURCE }
		for (const [csvColumn, column, convert] of columns) {
			row[column] = convert(record[csvColumn] ?? "", tzid)
		}
		const measurements = columns.filter(([, column]) => column !== key)
		if (row[key] === null || measurements.every(([, column]) => row[column] === null)) {
			return
		}
		rows.push(row)
	})
	return { kind, rows }
}

/**
 * The INSERT for each export type, `?`-positional, matching `ringconnParams`.
 *
 * Idempotent by the natural key: a second import of the same session or day
 * updates in place instead of duplicating. Gap-filling only: the `WHERE` clause
 * makes an import step around anything a person entered — that is V0.1's
 * "imported data never overwrites a manual entry", enforced in the statement
 * itself so no caller can forget it.
 */
export const RINGCONN_UPSERT = Object.fromEntries(Object.entries(TABLES).map(([kind, spec]) => [kind, upsertSql(spec)]))

/**
 * Bind values for `RINGCONN_UPSERT[kind]`, in the statement's order.
 * @param {"activity" | "sleep" | "vitals"} kind
 * @param {object} row  one row from `parseRingconnCsv`
 * @param {{ id?: string, createdAt: number }} meta  `id` is required for sleep (a new UUIDv7); it is ignored on conflict
 */
export function ringconnParams(kind, row, { id, createdAt }) {
	const { columns, withId } = TABLES[kind]
	const values = columns.map(([, column]) => row[column])
	return [...(withId ? [id] : []), ...values, row.source, createdAt]
}

function upsertSql({ table, key, withId, columns }) {
	const names = [...(withId ? ["id"] : []), ...columns.map(([, column]) => column), "source", "created_at"]
	// Everything but the key and the first-write-only columns (id, created_at) refreshes.
	const refreshed = [...columns.map(([, column]) => column), "source"].filter((column) => column !== key)
	const updates = refreshed.map((column) => `${column} = excluded.${column}`).join(", ")
	return (
		`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ` +
		`ON CONFLICT(${key}) DO UPDATE SET ${updates} WHERE ${table}.source != 'manual'`
	)
}

// Cell converters. A blank cell is null; a cell that fails to convert is null too,
// so one odd value costs one measurement, never the row or the import.

function text(cell) {
	return cell === "" ? null : cell
}

function integer(cell) {
	const value = Number(cell)
	return cell === "" || Number.isNaN(value) ? null : value
}

/** `86.00%` → 86, `96%` → 96. */
function percent(cell) {
	return integer(cell.replace(/%$/, ""))
}

/** `2024-10-24 00:12:56`, naive, in `tzid` → epoch ms. */
function instant(cell, tzid) {
	const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(cell)
	if (!match) {
		return null
	}
	const [, year, month, day, hour, minute, second] = match.map(Number)
	return new TZDate(year, month - 1, day, hour, minute, second, tzid).getTime()
}
