import { cva } from "class-variance-authority"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// Copied from react-native-reusables; variants renamed to Material 3 and every
// colour replaced by a role token. Put a <Text> inside for the label — it picks
// up the matching on-colour through TextClassContext.

const buttonVariants = cva("flex-row items-center justify-center gap-xs rounded-seg active:opacity-80", {
	variants: {
		variant: {
			filled: "bg-primary",
			tonal: "bg-secondary-container",
			outlined: "border border-outline",
			text: "",
			destructive: "bg-error",
		},
		size: {
			sm: "px-sm py-2xs",
			md: "px-md py-xs",
		},
	},
	defaultVariants: { variant: "filled", size: "md" },
})

const labelVariants = cva("font-body-semibold text-label", {
	variants: {
		variant: {
			filled: "text-on-primary",
			tonal: "text-on-secondary-container",
			outlined: "text-primary",
			text: "text-primary",
			destructive: "text-on-error",
		},
	},
	defaultVariants: { variant: "filled" },
})

export function Button({ className, variant, size, disabled, ...props }) {
	return (
		<TextClassContext.Provider value={labelVariants({ variant })}>
			<Pressable
				role="button"
				disabled={disabled}
				className={cn(buttonVariants({ variant, size }), disabled && "opacity-50", className)}
				{...props}
			/>
		</TextClassContext.Provider>
	)
}
