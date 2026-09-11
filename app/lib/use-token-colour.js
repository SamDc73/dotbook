import { useUnstableNativeVariable } from "nativewind"
import { Platform } from "react-native"

// The sanctioned escape hatch for a library that demands a colour as a JavaScript
// value (live-markdown's `markdownStyle`). It reads the LIVE variable — the same
// one `bg-primary` resolves to — so it follows Material You and dark mode instead
// of freezing a hex. Use it nowhere else: components take token classes.
//
//   const primary = useTokenColour("--color-primary")

function useWebVariable(name) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const useTokenColour = Platform.OS === "web" ? useWebVariable : useUnstableNativeVariable
