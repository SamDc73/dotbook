import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as Device from "expo-device"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { Platform, View } from "react-native"
import { rollupsOn } from "../db/screenTime"
import { useLiveQuery } from "../db/use-live-query"
import { today } from "../lib/day"
import { minutesLabel } from "../lib/format"
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

const STATUS_QUERY = ["screen-time", "status"]

async function readStatus() {
	const [granted, collectedAt, labels] = await Promise.all([
		hasPermission(),
		Storage.getItemAsync(LAST_COLLECTED_KEY),
		Storage.getItemAsync(LABELS_KEY),
	])
	return { granted, collectedAt: collectedAt === null ? null : Number(collectedAt), labels: JSON.parse(labels ?? "{}") }
}

const NO_STATUS = { granted: false, collectedAt: null, labels: {} }

export function ScreenTimeSection() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const device = Device.deviceName ?? "android"

	const { data: status = NO_STATUS } = useQuery({ queryKey: STATUS_QUERY, queryFn: readStatus })
	const rows = useLiveQuery(["screen-time", "today", today()], () => rollupsOn(db, today()))
	const apps = rows.filter((row) => row.source === "android:usagestats")
	const sites = rows.filter((row) => row.source === "ext:firefox")

	async function collect() {
		await collectDays(db, device)
		queryClient.invalidateQueries({ queryKey: STATUS_QUERY })
	}

	if (Platform.OS !== "android") {
		return (
			<Section>
				<Text className="text-on-surface-variant">Android only</Text>
			</Section>
		)
	}

	return (
		<Section>
			<Row label="Usage access" value={status.granted ? "granted" : "not granted"} />
			<Row label="Device" value={device} />
			<Row
				label="Last collected"
				value={status.collectedAt === null ? "never" : new Date(status.collectedAt).toLocaleTimeString()}
			/>
			<View className="flex-row gap-sm">
				<Button variant="tonal" onPress={openSettings}>
					<Text>Open settings</Text>
				</Button>
				<Button variant="filled" onPress={collect} disabled={!status.granted}>
					<Text>Collect now</Text>
				</Button>
			</View>
			{apps.map((app) => (
				<View key={app.key} className="gap-2xs">
					<Row label={status.labels[app.key] ?? app.key} value={minutesLabel(app.seconds * 1000)} />
					{isFirefox(app.key)
						? sites.map((site) => (
								<Row
									key={`${site.device}|${site.key}`}
									label={site.key}
									value={minutesLabel(site.seconds * 1000)}
									indented
								/>
							))
						: null}
				</View>
			))}
		</Section>
	)
}

function Section({ children }) {
	return <View className="gap-sm">{children}</View>
}

function Row({ label, value, indented = false }) {
	return (
		<View className={indented ? "flex-row justify-between pl-lg" : "flex-row justify-between"}>
			<Text className="text-on-surface-variant">{label}</Text>
			<Text>{value}</Text>
		</View>
	)
}

// Firefox, Firefox Beta and Nightly (fenix) — the packages the extension runs in.
function isFirefox(packageName) {
	return packageName.startsWith("org.mozilla.")
}
