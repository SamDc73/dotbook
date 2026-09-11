import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"
import { today } from "../lib/day"

// "class every Tue/Thu at 14:00" as a form. Its output is the `parts` shape
// core's ruleFromParts takes, plus the line text, an optional duration, and
// whether occurrences are plans or logs.

const FREQS = ["daily", "weekly", "monthly"]
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
const KINDS = ["plan", "log"]

export function RecurrenceForm({ initial = null, onSave, onCancel }) {
	const [text, setText] = useState(initial?.text ?? "")
	const [freq, setFreq] = useState(initial?.parts.freq ?? "weekly")
	const [byDay, setByDay] = useState(initial?.parts.byDay ?? [])
	const [interval, setEvery] = useState(String(initial?.parts.interval ?? 1))
	const [time, setTime] = useState(initial ? clock(initial.parts) : "")
	const [duration, setDuration] = useState(initial?.durationMin ? String(initial.durationMin) : "")
	const [dtstart, setDtstart] = useState(initial?.parts.dtstart ?? today())
	const [kind, setKind] = useState(initial?.kind ?? "plan")

	const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
	const canSave =
		text.trim() !== "" && timeMatch !== null && /^\d{4}-\d{2}-\d{2}$/.test(dtstart) && Number(interval) >= 1

	function toggleDay(code) {
		setByDay(byDay.includes(code) ? byDay.filter((day) => day !== code) : [...byDay, code])
	}

	function save() {
		onSave({
			text,
			parts: {
				freq,
				interval: Number(interval),
				byDay: freq === "weekly" ? byDay : [],
				hour: Number(timeMatch[1]),
				minute: Number(timeMatch[2]),
				dtstart,
				tzid: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
			durationMin: duration.trim() === "" ? null : Number(duration),
			kind,
		})
	}

	return (
		<View className="mx-md mb-sm gap-sm rounded-md bg-surface-container-low p-sm">
			<TextInput className={FIELD} value={text} onChangeText={setText} placeholder="class" autoFocus />

			<Row label="Every">
				{FREQS.map((value) => (
					<Chip key={value} selected={freq === value} onPress={() => setFreq(value)}>
						{value}
					</Chip>
				))}
				<TextInput
					className={SMALL_FIELD}
					value={interval}
					onChangeText={setEvery}
					keyboardType="number-pad"
					placeholder="1"
				/>
			</Row>

			{freq === "weekly" ? (
				<Row label="On">
					{WEEKDAYS.map((code) => (
						<Chip key={code} selected={byDay.includes(code)} onPress={() => toggleDay(code)}>
							{code}
						</Chip>
					))}
				</Row>
			) : null}

			<Row label="At">
				<TextInput className={SMALL_FIELD} value={time} onChangeText={setTime} placeholder="14:00" />
				<Text className="text-caption text-on-surface-variant">for</Text>
				<TextInput
					className={SMALL_FIELD}
					value={duration}
					onChangeText={setDuration}
					keyboardType="number-pad"
					placeholder="min"
				/>
				<Text className="text-caption text-on-surface-variant">from</Text>
				<TextInput className={SMALL_FIELD} value={dtstart} onChangeText={setDtstart} placeholder="YYYY-MM-DD" />
			</Row>

			<Row label="As">
				{KINDS.map((value) => (
					<Chip key={value} selected={kind === value} onPress={() => setKind(value)}>
						{value}
					</Chip>
				))}
			</Row>

			<View className="flex-row justify-end gap-xs">
				<Pressable onPress={onCancel} className="rounded-md px-sm py-2xs active:bg-surface-container">
					<Text className="text-label text-on-surface-variant">Cancel</Text>
				</Pressable>
				<Pressable
					onPress={save}
					disabled={!canSave}
					className={canSave ? "rounded-md bg-primary px-sm py-2xs" : "rounded-md bg-surface-variant px-sm py-2xs"}
				>
					<Text className={canSave ? "text-label text-on-primary" : "text-label text-on-surface-variant"}>Save</Text>
				</Pressable>
			</View>
		</View>
	)
}

const FIELD = "rounded-sm bg-surface px-sm py-2xs text-body text-on-surface"
const SMALL_FIELD = "rounded-sm bg-surface px-sm py-2xs text-label text-on-surface"

function Row({ label, children }) {
	return (
		<View className="flex-row flex-wrap items-center gap-xs">
			<Text className="text-caption text-on-surface-variant">{label}</Text>
			{children}
		</View>
	)
}

function Chip({ selected, onPress, children }) {
	return (
		<Pressable
			onPress={onPress}
			className={selected ? "rounded-sm bg-primary-container px-2xs py-3xs" : "rounded-sm px-2xs py-3xs"}
		>
			<Text className={selected ? "text-label text-on-primary-container" : "text-label text-on-surface-variant"}>
				{children}
			</Text>
		</Pressable>
	)
}

function clock(parts) {
	return `${parts.hour}:${String(parts.minute).padStart(2, "0")}`
}
