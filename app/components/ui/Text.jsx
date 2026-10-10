import { cva } from "class-variance-authority"
import { useContext } from "react"
import { Text as NativeText } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// Copied from react-native-reusables and converted to our tokens. The variants
// are the template's type roles, each a step of the golden scale with its own
// line height: Instrument Sans for reading, Fraunces for a screen's title,
// IBM Plex Mono for times, chips, data and eyebrows.
const textVariants = cva("font-body text-on-surface", {
	variants: {
		variant: {
			caption: "text-caption leading-caption",
			label: "text-label leading-label",
			body: "text-body leading-body",
			line: "text-callout leading-callout",
			subheading: "font-body-semibold text-subheading leading-subheading",
			heading: "font-display-medium text-heading leading-heading",
			title: "font-display-medium text-title2 leading-title2",
			eyebrow: "font-mono text-caption leading-caption uppercase tracking-caps text-on-surface-variant",
			mono: "font-mono text-caption leading-caption tabular-nums",
			data: "font-mono-regular text-label leading-label tabular-nums text-on-surface-variant",
		},
	},
	defaultVariants: { variant: "body" },
})

export function Text({ className, variant, ...props }) {
	const contextClass = useContext(TextClassContext)
	return <NativeText className={cn(textVariants({ variant }), contextClass, className)} {...props} />
}
