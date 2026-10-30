import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as Device from "expo-device"
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import { addDatabaseChangeListener, SQLiteProvider } from "expo-sqlite"
import { Suspense, useEffect } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ActivityIndicator, AppState, Platform } from "react-native"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { useDb } from "@/db/context"
import { DatabaseError } from "../db/DatabaseError"
import { migrate } from "../db/migrate"
import * as Notifications from "../notifications/native"
import { reconcile } from "../notifications/reminders"
import { answerResponse } from "../notifications/respond"
import { setupNotifications } from "../notifications/setup"
import { registerResponseTask } from "../notifications/task"
import { useCollectScreenTime } from "../screenTime/collect"
import { useSync } from "../sync/use-sync"
import { FONTS } from "../theme/fonts"
import { MaterialYou } from "../theme/MaterialYou"
import "../global.css"
import LiveQueriesWeb from "../components/LiveQueries.web"

// One query client for the app. Nothing goes stale on its own — the database
// is local, so the only thing that changes an answer is a write, and
// LiveQueries below invalidates every query when one lands.
const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, gcTime: 5 * 60 * 1000, retry: false } },
})

const LOADING = <ActivityIndicator className="flex-1 bg-background text-primary" />

// The Suspense provider caches the open database by these props' identity. An
// inline object here is new on every mount, so BACK and then the app again closed
// the connection and reopened it at once; the reopen raced the close and locked.
const DB_OPTIONS = { enableChangeListener: true }

// The navigator paints each scene light grey in both themes; a screen not yet
// drawn would flash it. Transparent, the window's colour shows instead, which
// is the background in either theme (plugins/withWindowColours.js).
const STACK = { headerShown: false, contentStyle: { backgroundColor: "transparent" } }

export default function RootLayout() {
	const [fontsLoaded] = useFonts(FONTS)
	if (!fontsLoaded) return LOADING

	// Web: the browser holds no database and syncs nothing — the server is the
	// data (db/*.web.js twins over HTTP). None of the native bootstrap exists
	// below: no SQLiteProvider, no Reminders, no Sync — just
	// the app, refetching on /api/v1/state (LiveQueriesWeb).
	if (Platform.OS === "web") {
		return (
			<ErrorBoundary FallbackComponent={DatabaseError}>
				<QueryClientProvider client={queryClient}>
					<LiveQueriesWeb />
					{/* No <Reminders> or DB – sync is a no‑op on web */}
					<MaterialYou>
						<KeyboardProvider>
							<Stack screenOptions={STACK} />
						</KeyboardProvider>
					</MaterialYou>
				</QueryClientProvider>
			</ErrorBoundary>
		)
	}

	// Native: opening the database can fail. The boundary shows the message and
	// a retry, which remounts the provider and opens again.
	return (
		<ErrorBoundary FallbackComponent={DatabaseError}>
			<Suspense fallback={LOADING}>
				<SQLiteProvider databaseName="dotbook.db" options={DB_OPTIONS} onInit={migrate} useSuspense>
					<QueryClientProvider client={queryClient}>
						<LiveQueries />
						<Reminders />
						<Sync />
						<MaterialYou>
							<KeyboardProvider>
								<Stack screenOptions={STACK} />
							</KeyboardProvider>
						</MaterialYou>
					</QueryClientProvider>
				</SQLiteProvider>
			</Suspense>
		</ErrorBoundary>
	)
}

// Every useLiveQuery in the app re-runs when the database changes: one listener,
// no per-query subscriptions. Table-scoped keys are not worth it yet — the
// database is local and small, so refetching every mounted query is a few reads.
// The CRDT bookkeeping tables are skipped: a sync round writes them for every
// message and the real tables right after, so they would only double the work.
// Changes arrive one row at a time, so a burst is folded into one invalidation.
const BOOKKEEPING = new Set(["messages_crdt", "messages_clock"])

function LiveQueries() {
	useEffect(() => {
		let scheduled = false
		const subscription = addDatabaseChangeListener(({ tableName }) => {
			if (BOOKKEEPING.has(tableName) || scheduled) return
			scheduled = true
			setTimeout(() => {
				scheduled = false
				queryClient.invalidateQueries()
			}, 0)
		})
		return () => subscription.remove()
	}, [])
	return null
}

// Channels, categories and the background task are registered once per app
// load, never per mount: StrictMode and a remount must not register twice.
let notificationsReady = false

// The rows that decide what rings: a todo closed or given a time — here or on
// another device — or a plan line moved reschedules once the writes settle.
const RINGS_ON = new Set(["reminders", "todos", "todo_links", "entries"])
const SETTLE_MS = 1000

// Keeps the scheduled alarms equal to the reminders table, and answers taps
// while the app is running. Taps while it is closed are the background task's
// (notifications/task.js); both go through the same answerResponse, which
// claims each tap once, so overlap is harmless.
function Reminders() {
	const db = useDb()
	// Android screen time, collected on every foreground once usage access is granted.
	useCollectScreenTime(db, Device.deviceName ?? "android")

	useEffect(() => {
		const foreground = AppState.addEventListener("change", (state) => {
			if (state === "active") reconcile(db)
		})
		let settle = null
		const changes = addDatabaseChangeListener(({ tableName }) => {
			if (!RINGS_ON.has(tableName)) return
			clearTimeout(settle)
			settle = setTimeout(() => reconcile(db), SETTLE_MS)
		})
		function stop() {
			foreground.remove()
			changes.remove()
			clearTimeout(settle)
		}
		if (Platform.OS === "web") {
			reconcile(db)
			return stop
		}

		if (notificationsReady) {
			reconcile(db)
		} else {
			notificationsReady = true
			setupNotifications()
				.then(registerResponseTask)
				.then(() => reconcile(db))
		}
		const taps = Notifications.addNotificationResponseReceivedListener((response) => answerResponse(db, response))
		// A tap that woke the app before this listener existed is still waiting here.
		Notifications.getLastNotificationResponseAsync().then((response) => response && answerResponse(db, response))
		return () => {
			stop()
			taps.remove()
		}
	}, [db])

	return null
}

// Syncs with the server when there is one configured: on start, on foreground,
// and after local changes settle. See app/sync.
function Sync() {
	const db = useDb()
	useSync(db)
	return null
}
