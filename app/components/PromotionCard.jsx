import { nextLabel } from "@dotbook/core/templates"
import { Text, View } from "react-native"
import { Button } from "./ui/Button"
import { Text as Label } from "./ui/Text"

// The one question a repeated deviation earns. It sits here, on a calm surface,
// never as a modal — and both answers are one tap. See V0.1 → "Promotion rules".
export function PromotionCard({ template, onAccept, onDecline }) {
	const { candidate, versions } = template
	const label = nextLabel(versions[0].label)

	return (
		<View className="gap-sm rounded-md bg-warning-container p-md">
			<Text className="text-label text-on-warning-container">{template.name}</Text>
			<Text className="text-body text-on-warning-container">
				{describe(candidate.deviation)} the last {candidate.days.length} times — make it v{label} from{" "}
				{candidate.effectiveFrom}?
			</Text>
			<View className="flex-row justify-end gap-sm">
				<Button variant="text" onPress={onDecline}>
					<Label className="text-on-warning-container">No, keep v{versions[0].label}</Label>
				</Button>
				<Button onPress={onAccept}>
					<Label>Make it v{label}</Label>
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
