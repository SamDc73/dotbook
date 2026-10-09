import { deserializeClock } from "@actual-app/crdt"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { View } from "react-native"
import { useLiveQuery } from "../db/use-live-query"
import { clock } from "../lib/format"
import { account, logOut } from "../sync/account"
import { STATUS, syncNow } from "../sync/client"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// Settings → Server. Logged out: one button to the login screen. Logged in:
// who and where, a sync button with its status line, and log out. The app
// works logged out; logging in is what turns sync on.
//
// The account and the status live in the query cache, not in effects: kv-store
// is read once per key, a login or logout invalidates the account, and a
// finished sync invalidates the status so the line refreshes.
const ACCOUNT_KEY = ["account"]
const STATUS_KEY = ["sync", "status"]
const EMPTY_ACCOUNT = { url: "", name: null }
const EMPTY_STATUS = { lastSync: null, lastError: null }

export function ServerSettings() {
	const db = useSQLiteContext()
	const router = useRouter()
	const queryClient = useQueryClient()
	const { data: who = EMPTY_ACCOUNT } = useQuery({ queryKey: ACCOUNT_KEY, queryFn: account })
	const { data: status = EMPTY_STATUS } = useQuery({ queryKey: STATUS_KEY, queryFn: readStatus })
	const [row] = useLiveQuery(["sync", "waiting"], () => waiting(db))

	async function sync() {
		await syncNow(db)
		queryClient.invalidateQueries({ queryKey: ["sync"] })
	}

	async function leave() {
		await logOut()
		queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY })
		queryClient.invalidateQueries({ queryKey: ["sync"] })
	}

	if (who.name === null) {
		return (
			<View className="gap-sm">
				<Text variant="caption" className="text-on-surface-variant">
					Not connected. The log works offline; logging in turns on sync and the web app.
				</Text>
				<View className="flex-row">
					<Button variant="tonal" onPress={() => router.push("/login")}>
						<Text>Log in</Text>
					</Button>
				</View>
			</View>
		)
	}

	return (
		<View className="gap-sm">
			<Text>Logged in as {who.name}</Text>
			<Text variant="caption" className="text-on-surface-variant">
				{who.url}
			</Text>
			<View className="flex-row items-center gap-md">
				<Button variant="tonal" onPress={sync}>
					<Text>Sync now</Text>
				</Button>
				<StatusLine status={status} waiting={row?.waiting ?? 0} />
			</View>
			<View className="flex-row">
				<Button variant="outlined" onPress={leave}>
					<Text>Log out</Text>
				</Button>
			</View>
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
