import { cva } from "class-variance-authority"
import { useContext } from "react"
import { Text as NativeText } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// Copied from react-native-reusables and converted to our tokens: the variants
// are the type scale in tokens.css, the default colour is the surface's on-colour.
const textVariants = cva("text-on-surface", {
	variants: {
		variant: {
			caption: "text-caption",
			label: "text-label",
			body: "text-body",
			callout: "text-callout",
			subheading: "text-subheading",
			heading: "text-heading",
			title: "text-title3",
		},
	},
	defaultVariants: { variant: "body" },
})

export function Text({ className, variant, ...props }) {
	const contextClass = useContext(TextClassContext)
	return <NativeText className={cn(textVariants({ variant }), contextClass, className)} {...props} />
}
