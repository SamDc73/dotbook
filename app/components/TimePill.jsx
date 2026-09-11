import { Text } from "./ui/Text"

// The time is the bullet. This is the template's `.tm`: Plex Mono, tabular
// figures, tinted by the hour it names — nothing else. A range is shown with a
// real arrow; the stored text keeps whatever was typed.
//
// Interim: a pill design is being chosen from a separate demo and will replace
// this file. Callers pass `timeText` (as typed) and the zero-padded `hour`.
export function TimePill({ timeText, hour }) {
	return (
		<Text variant="mono" className={`text-hour-${hour}`}>
			{timeText.replace(/\s*->\s*/, " → ")}
		</Text>
	)
}
