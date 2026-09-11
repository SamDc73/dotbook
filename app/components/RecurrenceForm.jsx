import { useState } from "react"
import { View } from "react-native"
import { today } from "../lib/day"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text } from "./ui/Text"

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
	const [time, setTime] = useState(() => (initial ? clock(initial.parts) : ""))
	const [duration, setDuration] = useState(initial?.durationMin ? String(initial.durationMin) : "")
	const [dtstart, setDtstart] = useState(initial?.parts.dtstart ?? today)
	const [kind, setKind] = useState(initial?.kind ?? "plan")

	const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
	const canSave =
		text.trim() !== "" && timeMatch !== null && /^\d{4}-\d{2}-\d{2}$/.test(dtstart) && Number(interval) >= 1

	function toggleDay(code) {
		setByDay((days) => (days.includes(code) ? days.filter((day) => day !== code) : [...days, code]))
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
		<View className="mx-md mb-sm gap-sm rounded-panel border border-outline-variant bg-surface p-sm">
			<Input value={text} onChangeText={setText} placeholder="class" autoFocus />

			<Row label="Every">
				{FREQS.map((value) => (
					<Choice key={value} selected={freq === value} onPress={() => setFreq(value)}>
						{value}
					</Choice>
				))}
				<Input className={SMALL} value={interval} onChangeText={setEvery} keyboardType="number-pad" placeholder="1" />
			</Row>

			{freq === "weekly" ? (
				<Row label="On">
					{WEEKDAYS.map((code) => (
						<Choice key={code} selected={byDay.includes(code)} onPress={() => toggleDay(code)}>
							{code}
						</Choice>
					))}
				</Row>
			) : null}

			<Row label="At">
				<Input className={SMALL} value={time} onChangeText={setTime} placeholder="14:00" />
				<Text variant="eyebrow">for</Text>
				<Input
					className={SMALL}
					value={duration}
					onChangeText={setDuration}
					keyboardType="number-pad"
					placeholder="min"
				/>
				<Text variant="eyebrow">from</Text>
				<Input className={SMALL} value={dtstart} onChangeText={setDtstart} placeholder="YYYY-MM-DD" />
			</Row>

			<Row label="As">
				{KINDS.map((value) => (
					<Choice key={value} selected={kind === value} onPress={() => setKind(value)}>
						{value}
					</Choice>
				))}
			</Row>

			<View className="flex-row justify-end gap-xs">
				<Button variant="text" size="sm" onPress={onCancel}>
					<Text>Cancel</Text>
				</Button>
				<Button size="sm" onPress={save} disabled={!canSave}>
					<Text>Save</Text>
				</Button>
			</View>
		</View>
	)
}

const SMALL = "py-2xs text-label"

function Row({ label, children }) {
	return (
		<View className="flex-row flex-wrap items-center gap-xs">
			<Text variant="eyebrow">{label}</Text>
			{children}
		</View>
	)
}

function Choice({ selected, onPress, children }) {
	return (
		<Badge variant={selected ? "primary" : "plain"} onPress={onPress}>
			{children}
		</Badge>
	)
}

function clock(parts) {
	return `${parts.hour}:${String(parts.minute).padStart(2, "0")}`
}
