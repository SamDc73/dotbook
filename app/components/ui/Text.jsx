import { cva } from "class-variance-authority"
import { useContext } from "react"
import { Text as NativeText } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// Copied from react-native-reusables and converted to our tokens. The variants
// are the template's type roles: Instrument Sans for reading, Fraunces for the
// one heading a screen has, IBM Plex Mono for times, chips, data and eyebrows.
const textVariants = cva("font-body text-on-surface", {
	variants: {
		variant: {
			caption: "text-caption",
			label: "text-label",
			body: "text-body",
			line: "text-line",
			callout: "text-callout",
			subheading: "font-body-semibold text-subheading",
			heading: "font-display-medium text-heading",
			title: "font-display text-title2",
			eyebrow: "font-mono text-eyebrow uppercase tracking-eyebrow text-on-surface-variant",
			mono: "font-mono text-time tabular-nums",
			data: "font-mono-regular text-label tabular-nums text-on-surface-variant",
		},
	},
	defaultVariants: { variant: "body" },
})

export function Text({ className, variant, ...props }) {
	const contextClass = useContext(TextClassContext)
	return <NativeText className={cn(textVariants({ variant }), contextClass, className)} {...props} />
}
