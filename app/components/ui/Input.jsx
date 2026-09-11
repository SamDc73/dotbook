import { TextInput } from "react-native"
import { useTokenColour } from "../../lib/use-token-colour"
import { cn } from "./cn"

// Copied from react-native-reusables' input and converted to tokens: a filled
// field on the surface colour with the template's hairline, body face. Everything else is React Native's
// TextInput — pass its props straight through.
//
// The placeholder colour is the one thing a TextInput takes only as a value,
// so it comes through the sanctioned live-token hook, not a literal.
export function Input({ className, ...props }) {
	const placeholderColour = useTokenColour("--color-outline")
	return (
		<TextInput
			className={cn(
				"rounded-seg border border-outline-variant bg-surface px-sm py-xs font-body text-body text-on-surface",
				props.editable === false ? "opacity-50" : null,
				className
			)}
			placeholderTextColor={placeholderColour}
			{...props}
		/>
	)
}
