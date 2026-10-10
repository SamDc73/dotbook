import { View } from "react-native"
import { cn } from "./cn"
import { Text } from "./Text"

// The template's `.panel`: a surface with a hairline, the soft cyan shadow, and
// an eyebrow as its heading. Sections of a screen are panels; rows inside are
// not. Padded by the size of the body text it holds (md) and turned at that
// text's size over its line height (1 ÷ φ, radius md). `flush` is a panel of
// rows that run edge to edge and pad themselves; its eyebrow keeps the md inset.
export function Panel({ eyebrow, flush = false, className, children, ...props }) {
	return (
		<View
			className={cn(
				"rounded-md border border-outline-variant bg-surface shadow-panel",
				flush ? "overflow-hidden" : "gap-sm p-md",
				className
			)}
			{...props}
		>
			{eyebrow ? (
				<Text variant="eyebrow" className={flush ? "px-md pt-md pb-xs" : undefined}>
					{eyebrow}
				</Text>
			) : null}
			{children}
		</View>
	)
}
