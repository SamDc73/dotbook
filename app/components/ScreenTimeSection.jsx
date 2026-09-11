import * as Device from "expo-device"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { useCallback, useEffect, useState } from "react"
import { Platform, View } from "react-native"
import { rollupsOn } from "../db/screenTime"
import { useLiveQuery } from "../db/use-live-query"
import { today } from "../lib/day"
import { collectDays, LABELS_KEY, LAST_COLLECTED_KEY } from "../screenTime/collect"
import { hasPermission, openSettings } from "../screenTime/usage"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// Settings → Screen time. Android only: the grant, the device name, when the
// last collection ran, and today's apps most time first.
//
// The double-count rule (V0.1 feature 7): the Firefox extension's per-site rows
// are a BREAKDOWN of the browser's own UsageStats figure. They are shown under
// the Firefox app row, indented, and are never added to it or to the day.
export function ScreenTimeSection() {
	const db = useSQLiteContext()
	const [granted, setGranted] = useState(false)
	const [collectedAt, setCollectedAt] = useState(null)
	const [labels, setLabels] = useState({})
	const device = Device.deviceName ?? "android"

	const query = useCallback(() => rollupsOn(db, today()), [db])
	const rows = useLiveQuery(db, query)
	const apps = rows.filter((row) => row.source === "android:usagestats")
	const sites = rows.filter((row) => row.source === "ext:firefox")

	useEffect(() => {
		hasPermission().then(setGranted)
		Storage.getItemAsync(LAST_COLLECTED_KEY).then((at) => at && setCollectedAt(Number(at)))
		readLabels().then(setLabels)
	}, [])

	async function collect() {
		await collectDays(db, device)
		setCollectedAt(Date.now())
		setLabels(await readLabels())
	}

	if (Platform.OS !== "android") {
		return (
			<Section title="Screen time">
				<Text className="text-on-surface-variant">Android only</Text>
			</Section>
		)
	}

	return (
		<Section title="Screen time">
			<Row label="Usage access" value={granted ? "granted" : "not granted"} />
			<Row label="Device" value={device} />
			<Row label="Last collected" value={collectedAt === null ? "never" : new Date(collectedAt).toLocaleTimeString()} />
			<View className="flex-row gap-sm">
				<Button variant="tonal" onPress={openSettings}>
					<Text>Open settings</Text>
				</Button>
				<Button variant="filled" onPress={collect} disabled={!granted}>
					<Text>Collect now</Text>
				</Button>
			</View>
			{apps.map((app) => (
				<View key={app.key} className="gap-2xs">
					<Row label={labels[app.key] ?? app.key} value={duration(app.seconds)} />
					{isFirefox(app.key) &&
						sites.map((site) => (
							<Row key={`${site.device}|${site.key}`} label={site.key} value={duration(site.seconds)} indented />
						))}
				</View>
			))}
		</Section>
	)
}

function Section({ title, children }) {
	return (
		<View className="gap-sm px-md py-sm">
			<Text variant="subheading">{title}</Text>
			{children}
		</View>
	)
}

function Row({ label, value, indented = false }) {
	return (
		<View className={indented ? "flex-row justify-between pl-lg" : "flex-row justify-between"}>
			<Text className="text-on-surface-variant">{label}</Text>
			<Text>{value}</Text>
		</View>
	)
}

async function readLabels() {
	return JSON.parse((await Storage.getItemAsync(LABELS_KEY)) ?? "{}")
}

// Firefox, Firefox Beta and Nightly (fenix) — the packages the extension runs in.
function isFirefox(packageName) {
	return packageName.startsWith("org.mozilla.")
}

function duration(seconds) {
	const minutes = Math.round(seconds / 60)
	const hours = Math.floor(minutes / 60)
	if (hours === 0) return `${minutes}m`
	return `${hours}h ${minutes % 60}m`
}
