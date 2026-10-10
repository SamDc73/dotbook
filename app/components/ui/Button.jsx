import { cva } from "class-variance-authority"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// Copied from react-native-reusables; variants renamed to Material 3 and every
// colour replaced by a role token. Put a <Text> inside for the label — it picks
// up the matching on-colour and size through TextClassContext. Proportions are
// the golden scale's: a pill holding one line at √φ, padded across by its own
// font size and above and below by √φ ÷ φ² of it. Every variant has a border,
// transparent unless outlined, so all of them stand the same height.

const buttonVariants = cva(
	"flex-row items-center justify-center gap-xs rounded-full border border-transparent active:opacity-80",
	{
		variants: {
			variant: {
				filled: "bg-primary",
				tonal: "bg-secondary-container",
				outlined: "border-outline",
				text: "",
				destructive: "bg-error",
			},
			size: {
				sm: "px-button-x-sm py-button-y-sm",
				md: "px-md py-button-y",
			},
		},
		defaultVariants: { variant: "filled", size: "md" },
	}
)

const labelVariants = cva("font-body-medium", {
	variants: {
		variant: {
			filled: "text-on-primary",
			tonal: "text-on-secondary-container",
			outlined: "text-primary",
			text: "text-primary",
			destructive: "text-on-error",
		},
		size: {
			sm: "text-subheading leading-subheading",
			md: "text-body leading-button",
		},
	},
	defaultVariants: { variant: "filled", size: "md" },
})

export function Button({ className, variant, size, disabled, ...props }) {
	return (
		<TextClassContext.Provider value={labelVariants({ variant, size })}>
			<Pressable
				role="button"
				disabled={disabled}
				className={cn(buttonVariants({ variant, size }), disabled && "opacity-50", className)}
				{...props}
			/>
		</TextClassContext.Provider>
	)
}
