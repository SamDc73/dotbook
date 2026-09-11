import { deserializeClock } from "@actual-app/crdt"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { View } from "react-native"
import { useLiveQuery } from "../db/use-live-query"
import { clock } from "../lib/format"
import { SETTINGS, STATUS, syncNow } from "../sync/client"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text } from "./ui/Text"

// Settings → Server. Three fields saved as typed, one button, one status line.
// The app works with all three empty; filling them in is what turns sync on.
//
// The fields and the status live in the query cache, not in effects: kv-store
// is read once per key, edits update the cache and the store together, and a
// finished sync invalidates the status so the line refreshes.
const FIELDS_KEY = ["server", "fields"]
const STATUS_KEY = ["sync", "status"]
const EMPTY_FIELDS = { url: "", token: "", group: "" }
const EMPTY_STATUS = { lastSync: null, lastError: null }

export function ServerSettings() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const { data: fields = EMPTY_FIELDS } = useQuery({ queryKey: FIELDS_KEY, queryFn: readFields })
	const { data: status = EMPTY_STATUS } = useQuery({ queryKey: STATUS_KEY, queryFn: readStatus })
	const [row] = useLiveQuery(["sync", "waiting"], () => waiting(db))

	function edit(name) {
		return (value) => {
			queryClient.setQueryData(FIELDS_KEY, (current) => ({ ...(current ?? EMPTY_FIELDS), [name]: value }))
			Storage.setItemAsync(SETTINGS[name], value)
		}
	}

	async function sync() {
		await syncNow(db)
		queryClient.invalidateQueries({ queryKey: ["sync"] })
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
			<Input autoCapitalize="none" autoCorrect={false} {...input} />
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

async function readFields() {
	const [url, token, group] = await Promise.all(Object.values(SETTINGS).map((key) => Storage.getItemAsync(key)))
	return { url: url ?? "", token: token ?? "", group: group ?? "" }
}

async function readStatus() {
	const [lastSync, lastError] = await Promise.all([
		Storage.getItemAsync(STATUS.lastSync),
		Storage.getItemAsync(STATUS.lastError),
	])
	return { lastSync, lastError }
}

// Own messages the server has not seen yet: stamped by this device (the
// timestamp ends with its node id) and newer than `since`, exactly what the
// next request will carry. No clock row yet means nothing was ever written.
async function waiting(db) {
	const state = await db.sql`SELECT clock, since FROM messages_clock WHERE id = 1`.first()
	if (!state) {
		return [{ waiting: 0 }]
	}
	const node = deserializeClock(state.clock).timestamp.node()
	return db.sql`SELECT count(*) AS waiting FROM messages_crdt
		WHERE timestamp > ${state.since} AND timestamp LIKE ${`%-${node}`}`
}
