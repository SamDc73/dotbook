import { nextLabel } from "@dotbook/core/templates"
import { View } from "react-native"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// The one question a repeated deviation earns. It sits here, on a calm surface —
// a panel on the pending wash, never a modal — and both answers are one tap.
// See V0.1 → "Promotion rules".
export function PromotionCard({ template, onAccept, onDecline }) {
	const { candidate, versions } = template
	const label = nextLabel(versions[0].label)

	return (
		<View className="gap-sm rounded-md border border-warning-line bg-warning-wash p-md">
			<Text variant="eyebrow" className="text-warning">
				{template.name}
			</Text>
			<Text variant="line">
				{describe(candidate.deviation)} the last {candidate.days.length} times — make it v{label} from{" "}
				{candidate.effectiveFrom}?
			</Text>
			<View className="flex-row justify-end gap-sm">
				<Button variant="text" onPress={onDecline}>
					<Text>No, keep v{versions[0].label}</Text>
				</Button>
				<Button onPress={onAccept}>
					<Text>Make it v{label}</Text>
				</Button>
			</View>
		</View>
	)
}

// `added creatine 5g, removed theanine, caffeine 100mg → caffeine 200mg`
function describe({ added, removed, changed }) {
	const parts = []
	if (added.length > 0) parts.push(`added ${added.join(", ")}`)
	if (removed.length > 0) parts.push(`removed ${removed.join(", ")}`)
	for (const [from, to] of changed) parts.push(`${from} → ${to}`)
	return parts.join(", ")
}
