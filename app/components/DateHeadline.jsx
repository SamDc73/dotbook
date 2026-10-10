import { addDays, differenceInCalendarDays, format, getDayOfYear, getISOWeek, parseISO, startOfISOWeek } from "date-fns"
import ChevronLeft from "lucide-react-native/icons/chevron-left"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import { useState } from "react"
import { Platform, Pressable, View } from "react-native"
import { today } from "../lib/day"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// The template's "Date headline": one Fraunces line, a mono sub-line, and
// almost nothing else. Moving between days is a gesture, not a button: swipe on
// touch, ← / → on a keyboard (see use-day-nav.js), chevrons that only exist
// while a mouse hovers here, and a tap on the date itself opens the week —
// seven days and Today — for a jump further than one.
export function DateHeadline({ day, section = null, onShift, onPick, children = null }) {
	const [hovered, setHovered] = useState(false)
	const [open, setOpen] = useState(false)
	const date = parseISO(day)

	function toggle() {
		setOpen((was) => !was)
	}
	function pick(next) {
		setOpen(false)
		onPick(next)
	}

	return (
		<View
			className="border-b border-outline-variant px-md pt-sm pb-sm wide:pt-lg"
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
		>
			<View className="flex-row items-start gap-sm">
				<Pressable
					onPress={toggle}
					className="flex-1 gap-2xs"
					accessibilityRole="button"
					accessibilityLabel="Pick a day"
				>
					<Text variant="title">{format(date, "EEEE d MMMM")}</Text>
					<Text variant="eyebrow">{subline(date, day, section)}</Text>
				</Pressable>
				{Platform.OS === "web" && hovered ? (
					<View className="flex-row gap-2xs">
						<Chevron glyph={ChevronLeft} label="Previous day" onPress={() => onShift(-1)} />
						<Chevron glyph={ChevronRight} label="Next day" onPress={() => onShift(1)} />
					</View>
				) : null}
				{children}
			</View>
			{open ? <Week day={day} onPick={pick} /> : null}
		</View>
	)
}

// `week 37 · day 253 · Today` — the section name first when the screen has one.
function subline(date, day, section) {
	const parts = [`week ${getISOWeek(date)}`, `day ${getDayOfYear(date)}`, relative(day)]
	if (section) parts.unshift(section)
	return parts.join(" · ")
}

function relative(day) {
	const delta = differenceInCalendarDays(parseISO(day), parseISO(today()))
	if (delta === 0) return "Today"
	if (delta === -1) return "yesterday"
	if (delta === 1) return "tomorrow"
	if (delta < 0) return `${-delta} days ago`
	return `in ${delta} days`
}

function Chevron({ glyph, label, onPress }) {
	return (
		<Pressable onPress={onPress} className="rounded-full p-xs active:bg-surface-container" accessibilityLabel={label}>
			<Icon as={glyph} className="text-on-surface-variant" />
		</Pressable>
	)
}

// The week the day is in, Monday first, plus a way back to today.
function Week({ day, onPick }) {
	const monday = startOfISOWeek(parseISO(day))
	const days = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"))
	const now = today()
	return (
		<View className="flex-row items-center gap-2xs pt-sm">
			{days.map((one) => (
				<Pressable
					key={one}
					onPress={() => onPick(one)}
					accessibilityState={{ selected: one === day }}
					className={
						one === day
							? "flex-1 items-center rounded-item bg-primary py-2xs"
							: "flex-1 items-center rounded-item py-2xs active:bg-surface-container"
					}
				>
					<Text variant="eyebrow" className={one === day ? "text-on-primary" : undefined}>
						{format(parseISO(one), "EEE")}
					</Text>
					<Text variant="line" className={numberClass(one, day, now)}>
						{format(parseISO(one), "d")}
					</Text>
				</Pressable>
			))}
			{day === now ? null : (
				<Pressable onPress={() => onPick(now)} className="rounded-item px-sm py-xs active:bg-surface-container">
					<Text variant="eyebrow" className="text-primary">
						Today
					</Text>
				</Pressable>
			)}
		</View>
	)
}

// The picked day reads on the primary fill; today is primary among the rest.
function numberClass(one, day, now) {
	if (one === day) return "text-on-primary"
	if (one === now) return "text-primary"
	return undefined
}
