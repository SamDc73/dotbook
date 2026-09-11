import { cva } from "class-variance-authority"
import { Pressable, View } from "react-native"
import { cn } from "./cn"
import { Text } from "./Text"

// Copied from react-native-reusables' badge and converted: the variants are
// Material 3 container roles, the label is our `label` size. A chip says one
// short thing — `3d late`, `nootstack v1.3`, `proposed` — and is pressable
// only when it is given an onPress.
const badgeVariants = cva("self-start rounded-sm px-2xs py-3xs", {
	variants: {
		variant: {
			primary: "bg-primary-container",
			secondary: "bg-secondary-container",
			tertiary: "bg-tertiary-container",
			error: "bg-error-container",
			warning: "bg-warning-container",
			surface: "bg-surface-container-high",
			plain: "",
		},
	},
	defaultVariants: { variant: "primary" },
})

const labelVariants = cva("text-label", {
	variants: {
		variant: {
			primary: "text-on-primary-container",
			secondary: "text-on-secondary-container",
			tertiary: "text-on-tertiary-container",
			error: "text-on-error-container",
			warning: "text-on-warning-container",
			surface: "text-on-surface-variant",
			plain: "text-on-surface-variant",
		},
	},
	defaultVariants: { variant: "primary" },
})

export function Badge({ variant, className, children, onPress, ...props }) {
	const Box = onPress ? Pressable : View
	return (
		<Box
			onPress={onPress}
			className={cn(badgeVariants({ variant }), onPress ? "active:opacity-80" : null, className)}
			{...props}
		>
			<Text className={labelVariants({ variant })}>{children}</Text>
		</Box>
	)
}
