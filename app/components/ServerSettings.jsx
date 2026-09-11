import { deserializeClock } from "@actual-app/crdt"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { useCallback, useEffect, useState } from "react"
import { TextInput, View } from "react-native"
import { useLiveQuery } from "../db/use-live-query"
import { SETTINGS, STATUS, syncNow } from "../sync/client"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// Settings → Server. Three fields saved as typed, one button, one status line.
// The app works with all three empty; filling them in is what turns sync on.
export function ServerSettings() {
	const db = useSQLiteContext()
	const [fields, setFields] = useState({ url: "", token: "", group: "" })
	const [status, setStatus] = useState({ lastSync: null, lastError: null })

	const waitingQuery = useCallback(() => waiting(db), [db])
	const [row] = useLiveQuery(db, waitingQuery)

	const loadStatus = useCallback(async () => {
		const [lastSync, lastError] = await Promise.all([
			Storage.getItemAsync(STATUS.lastSync),
			Storage.getItemAsync(STATUS.lastError),
		])
		setStatus({ lastSync, lastError })
	}, [])

	useEffect(() => {
		Promise.all(Object.values(SETTINGS).map((key) => Storage.getItemAsync(key))).then(([url, token, group]) =>
			setFields({ url: url ?? "", token: token ?? "", group: group ?? "" })
		)
		loadStatus()
	}, [loadStatus])

	function edit(name) {
		return (value) => {
			setFields({ ...fields, [name]: value })
			Storage.setItemAsync(SETTINGS[name], value)
		}
	}

	async function sync() {
		await syncNow(db)
		await loadStatus()
	}

	return (
		<View className="gap-sm px-md py-sm">
			<Text variant="subheading">Server</Text>
			<Field label="URL" value={fields.url} onChangeText={edit("url")} placeholder="https://life.example.com" />
			<Field label="Token" value={fields.token} onChangeText={edit("token")} secureTextEntry />
			<Field label="Group" value={fields.group} onChangeText={edit("group")} placeholder="default" />
			<View className="flex-row items-center gap-md">
				<Button variant="tonal" onPress={sync}>
					<Text>Sync now</Text>
				</Button>
				<StatusLine status={status} waiting={row?.waiting ?? 0} />
			</View>
		</View>
	)
}

function Field({ label, ...input }) {
	return (
		<View className="gap-2xs">
			<Text variant="label" className="text-on-surface-variant">
				{label}
			</Text>
			<TextInput
				className="rounded-md border border-outline-variant px-sm py-xs text-body text-on-surface"
				autoCapitalize="none"
				autoCorrect={false}
				{...input}
			/>
		</View>
	)
}

function StatusLine({ status, waiting }) {
	if (status.lastError !== null) {
		return (
			<Text variant="caption" className="flex-1 text-error">
				{status.lastError} · {waiting} waiting
			</Text>
		)
	}
	const when = status.lastSync === null ? "never" : clock(Number(status.lastSync))
	return (
		<Text variant="caption" className="flex-1 text-on-surface-variant">
			last sync {when} · {waiting} waiting
		</Text>
	)
}

// Own messages the server has not seen yet: stamped by this device (the
// timestamp ends with its node id) and newer than `since`, exactly what the
// next request will carry. No clock row yet means nothing was ever written.
async function waiting(db) {
	const clock = await db.sql`SELECT clock, since FROM messages_clock WHERE id = 1`.first()
	if (!clock) {
		return [{ waiting: 0 }]
	}
	const node = deserializeClock(clock.clock).timestamp.node()
	return db.sql`SELECT count(*) AS waiting FROM messages_crdt
		WHERE timestamp > ${clock.since} AND timestamp LIKE ${`%-${node}`}`
}

function clock(epochMs) {
	return new Date(epochMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
