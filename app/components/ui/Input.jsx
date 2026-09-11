import { TextInput } from "react-native"
import { cn } from "./cn"

// Copied from react-native-reusables' input and converted to tokens: a filled
// field on the surface colour with the template's hairline, body face. Everything else is React Native's
// TextInput — pass its props straight through.
export function Input({ className, ...props }) {
	return (
		<TextInput
			className={cn(
				"rounded-seg border border-outline-variant bg-surface px-sm py-xs font-body text-body text-on-surface",
				props.editable === false ? "opacity-50" : null,
				className
			)}
			{...props}
		/>
	)
}
