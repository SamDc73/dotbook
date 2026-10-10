import { cva } from "class-variance-authority"
import { Pressable, View } from "react-native"
import { cn } from "./cn"
import { Text } from "./Text"

// Copied from react-native-reusables' badge and converted to the template's
// chip: a mono label on the colour's wash, ringed by its hairline — the version
// token and the habit-state label of the palette page. A chip says one short
// thing (`3d late`, `nootstack v1.3`, `kept`) and is pressable only when it is
// given an onPress. `caps` is the state-label form: uppercase, letterspaced.
// Caption mono, one line, so a chip stands barely taller than the log line it
// sits in; its corner is the caption's (radius-chip).
const badgeVariants = cva("self-start flex-row items-center gap-3xs rounded-chip border px-xs py-3xs", {
	variants: {
		variant: {
			primary: "border-primary-line bg-primary-wash",
			success: "border-success-line bg-success-wash",
			error: "border-error-line bg-error-wash",
			warning: "border-warning-line bg-warning-wash",
			tertiary: "border-tertiary-line bg-tertiary-wash",
			surface: "border-outline-variant bg-surface",
			plain: "border-transparent",
		},
	},
	defaultVariants: { variant: "primary" },
})

const labelVariants = cva("font-mono text-caption leading-caption", {
	variants: {
		variant: {
			primary: "text-primary",
			success: "text-success",
			error: "text-error",
			warning: "text-warning",
			tertiary: "text-tertiary",
			surface: "text-on-surface-variant",
			plain: "text-on-surface-variant",
		},
		caps: { true: "uppercase tracking-caps", false: "" },
	},
	defaultVariants: { variant: "primary", caps: false },
})

export function Badge({ variant, caps = false, className, children, onPress, ...props }) {
	const Box = onPress ? Pressable : View
	return (
		<Box
			onPress={onPress}
			className={cn(badgeVariants({ variant }), onPress ? "active:opacity-80" : null, className)}
			{...props}
		>
			<Text className={labelVariants({ variant, caps })}>{children}</Text>
		</Box>
	)
}
