import { localDay } from "@dotbook/core/parse"
import * as DocumentPicker from "expo-document-picker"
import { File } from "expo-file-system"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { View } from "react-native"
import { exportMarkdown, importMarkdown } from "../db/markdown"
import { saveFile } from "../lib/saveFile"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// Settings → Your data. One Markdown file out, the same file back in.
export function DataSection() {
	const db = useSQLiteContext()
	const [status, setStatus] = useState(null)

	async function exportAll() {
		try {
			const { text, lines, days } = await exportMarkdown(db)
			await saveFile(`dotbook-${localDay(Date.now())}.md`, text, "text/markdown")
			setStatus(`exported ${lines} lines over ${days} days`)
		} catch (error) {
			setStatus(`export failed: ${error.message}`)
		}
	}

	async function importFile() {
		try {
			const picked = await DocumentPicker.getDocumentAsync({
				type: ["text/markdown", "text/plain", "*/*"],
				copyToCacheDirectory: true,
			})
			if (picked.canceled) return
			const [asset] = picked.assets
			const text = asset.file ? await asset.file.text() : await new File(asset.uri).text()
			setStatus("importing…")
			const c = await importMarkdown(db, text)
			setStatus(
				`${c.lines} lines · ${c.todos} todos · ${c.habits} habits · ${c.templates} templates · ${c.recurrences} rules added · ${c.skipped} already here`
			)
		} catch (error) {
			setStatus(`import failed: ${error.message}`)
		}
	}

	return (
		<View className="gap-sm">
			<Text variant="caption" className="text-on-surface-variant">
				One Markdown file: the log by day, then todos, habits, templates and recurring rules. Importing it again adds
				only what is missing.
			</Text>
			<View className="flex-row items-center gap-md">
				<Button variant="tonal" onPress={exportAll}>
					<Text>Export</Text>
				</Button>
				<Button variant="outlined" onPress={importFile}>
					<Text>Import</Text>
				</Button>
			</View>
			{status === null ? null : <Text variant="caption">{status}</Text>}
		</View>
	)
}
