import { useWindowDimensions } from "react-native"

// The template's breakpoint, 46rem, as the number layout code needs. The same
// value lives in tokens.css as `--breakpoint-wide` for the `wide:` utilities;
// this is the one place JavaScript needs it (which side the navigator lays the
// bar on cannot be a class).
export const WIDE = 46 * 16

export function useWide() {
	return useWindowDimensions().width >= WIDE
}
