import { isDynamicThemeSupported, useMaterial3Theme } from "@pchmn/expo-material3-theme"
import { VariableContextProvider } from "nativewind"
import { useColorScheme } from "react-native"

// Material You. On Android 12+ the wallpaper palette replaces the colour roles
// in tokens.css; everywhere else children render untouched and tokens.css is
// the fallback — never the library's generated one.
//
// This is the one place a colour value passes through JavaScript. It exists to
// feed the variable system so `bg-primary` keeps resolving; it styles nothing.

// Exactly the Material 3 roles tokens.css defines. `success`, `warning` and
// `info` are the design system additions the system does not generate, so they stay static.
const ROLES = [
	"primary",
	"onPrimary",
	"primaryContainer",
	"onPrimaryContainer",
	"secondary",
	"onSecondary",
	"secondaryContainer",
	"onSecondaryContainer",
	"tertiary",
	"onTertiary",
	"tertiaryContainer",
	"onTertiaryContainer",
	"error",
	"onError",
	"errorContainer",
	"onErrorContainer",
	"background",
	"onBackground",
	"surface",
	"onSurface",
	"surfaceVariant",
	"onSurfaceVariant",
	"surfaceDim",
	"surfaceBright",
	"surfaceContainerLowest",
	"surfaceContainerLow",
	"surfaceContainer",
	"surfaceContainerHigh",
	"surfaceContainerHighest",
	"outline",
	"outlineVariant",
	"shadow",
	"scrim",
	"inverseSurface",
	"inverseOnSurface",
	"inversePrimary",
]

export function MaterialYou({ children }) {
	if (!isDynamicThemeSupported) return children
	return <WallpaperColours>{children}</WallpaperColours>
}

function WallpaperColours({ children }) {
	const { theme } = useMaterial3Theme()
	const scheme = theme[useColorScheme() ?? "light"]

	const variables = {}
	for (const role of ROLES) {
		variables[`--color-${kebab(role)}`] = scheme[role]
	}
	return <VariableContextProvider value={variables}>{children}</VariableContextProvider>
}

// surfaceContainerLow → surface-container-low, matching the names in tokens.css.
function kebab(role) {
	return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
