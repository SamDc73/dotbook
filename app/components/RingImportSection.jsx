import { detectRingconnFile } from "@dotbook/core/import"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as DocumentPicker from "expo-document-picker"
import { File } from "expo-file-system"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { useState } from "react"
import { View } from "react-native"
import { importRingconn } from "../db/ringconn"
import { useLiveQuery } from "../db/use-live-query"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// Settings → RingConn. Pick the exported CSVs (all three at once is fine), and
// each file reports what it added. Counts only — the trends screen draws them.

const IMPORTED_AT_KEY = "ringconn-imported-at"
const IMPORTED_AT_QUERY = ["pref", IMPORTED_AT_KEY]

export function RingImportSection() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const [results, setResults] = useState([]) // [{ name, line }] of the last import

	const { data: importedAt = null } = useQuery({
		queryKey: IMPORTED_AT_QUERY,
		queryFn: () => Storage.getItemAsync(IMPORTED_AT_KEY).then((at) => (at === null ? null : Number(at))),
	})
	const [stored] = useLiveQuery(["ringconn", "totals"], () => totals(db))

	async function pick() {
		let files
		try {
			files = await pickFiles()
		} catch (error) {
			setResults([{ name: "import", line: `failed: ${error.message}` }])
			return
		}
		if (files.length === 0) return
		// The ring app writes naive local times; this device's zone is the best guess.
		const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone
		const lines = []
		for (const { name, text } of files) {
			lines.push({ name, line: await importOne(db, text, tzid).catch((error) => `failed: ${error.message}`) })
		}
		setResults(lines)
		const now = Date.now()
		Storage.setItemAsync(IMPORTED_AT_KEY, String(now))
		queryClient.setQueryData(IMPORTED_AT_QUERY, now)
	}

	return (
		<View className="gap-sm">
			<Text variant="caption" className="text-on-surface-variant">
				Export CSVs from the RingConn app: Activity, Sleep, Vital Signs
			</Text>
			<View className="flex-row items-center gap-md">
				<Button variant="tonal" onPress={pick}>
					<Text>Import CSV</Text>
				</Button>
				<Text variant="caption" className="flex-1 text-on-surface-variant">
					{importedAt === null ? "never imported" : `last import ${new Date(importedAt).toLocaleString()}`}
				</Text>
			</View>
			{results.map(({ name, line }) => (
				<Text key={name} variant="caption" numberOfLines={1}>
					{name} · {line}
				</Text>
			))}
			{stored ? (
				<Text variant="caption" className="text-on-surface-variant">
					{stored.nights} nights · {stored.vitals} days of vitals · {stored.activity} days of activity
				</Text>
			) : null}
		</View>
	)
}

// One file's status line. An unrecognised header is a plain fact, not an error.
async function importOne(db, text, tzid) {
	if (detectRingconnFile(text.split(/\r?\n/, 1)[0]) === null) return "not a RingConn export"
	const { inserted, updated, skipped } = await importRingconn(db, text, tzid)
	return `${inserted} new · ${updated} updated · ${skipped} skipped`
}

// The picked files as text. On web the picker hands over DOM Files; natively
// it hands over URIs that expo-file-system's File reads.
async function pickFiles() {
	const result = await DocumentPicker.getDocumentAsync({
		type: ["text/csv", "text/comma-separated-values", "*/*"],
		copyToCacheDirectory: true,
		multiple: true,
	})
	if (result.canceled) return []
	return Promise.all(
		result.assets.map(async (asset) => ({
			name: asset.name,
			text: asset.file ? await asset.file.text() : await new File(asset.uri).text(),
		}))
	)
}

function totals(db) {
	return db.sql`SELECT
		(SELECT count(*) FROM sleep_sessions) AS nights,
		(SELECT count(*) FROM daily_vitals) AS vitals,
		(SELECT count(*) FROM daily_activity) AS activity`
}
