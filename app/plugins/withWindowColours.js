// The Android window's colour is the background React paints, taken from
// theme/tokens.css. The window shows before React does: behind the launcher
// icon on the launch splash (Android 12+ uses the window background when it
// is a single colour), on the first frame, and wherever the keyboard uncovers.
// Left to the theme it is AppCompat's #303030 / #FAFAFA — a grey flash in dark
// mode. On Android 12+ the app follows the wallpaper (theme/MaterialYou.jsx),
// whose background is the system's neutral 10 / 900, so the window does too.
const fs = require("node:fs")
const path = require("node:path")
const {
	AndroidConfig,
	XML,
	withAndroidColors,
	withAndroidColorsNight,
	withAndroidStyles,
	withDangerousMod,
} = require("expo/config-plugins")

const COLOUR = "activityBackground"
const WALLPAPER = {
	"values-v31": "@android:color/system_neutral1_10",
	"values-night-v31": "@android:color/system_neutral1_900",
}
const THEMES = [
	{ name: "AppTheme", parent: "Theme.AppCompat.DayNight.NoActionBar" },
	{ name: "Theme.App.SplashScreen", parent: "AppTheme" },
]

// `--color-background` in the light block, then in the dark one.
function tokenBackgrounds(projectRoot) {
	const css = fs.readFileSync(path.join(projectRoot, "theme/tokens.css"), "utf8")
	const pick = (from) => /--color-background:\s*(#[0-9a-fA-F]{6})/.exec(css.slice(from))?.[1]
	const light = pick(0)
	const dark = pick(css.indexOf("@media (prefers-color-scheme: dark)"))
	if (!light || !dark) throw new Error("withWindowColours: --color-background not found in theme/tokens.css")
	return { light, dark }
}

function withDayColour(config) {
	return withAndroidColors(config, (mod) => {
		const { light } = tokenBackgrounds(mod.modRequest.projectRoot)
		mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, { name: COLOUR, value: light })
		return mod
	})
}

function withNightColour(config) {
	return withAndroidColorsNight(config, (mod) => {
		const { dark } = tokenBackgrounds(mod.modRequest.projectRoot)
		mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, { name: COLOUR, value: dark })
		return mod
	})
}

// Both the launch theme and the one the activity switches to before it draws.
function withWindowBackground(config) {
	return withAndroidStyles(config, (mod) => {
		const item = AndroidConfig.Resources.buildResourceItem({
			name: "android:windowBackground",
			value: `@color/${COLOUR}`,
		})
		for (const parent of THEMES) {
			mod.modResults = AndroidConfig.Styles.setStylesItem({ xml: mod.modResults, parent, item })
		}
		return mod
	})
}

// Resource folders the colour mods do not reach: written as files.
function withWallpaperColours(config) {
	return withDangerousMod(config, [
		"android",
		async (mod) => {
			for (const [folder, value] of Object.entries(WALLPAPER)) {
				const file = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res", folder, "colors.xml")
				fs.mkdirSync(path.dirname(file), { recursive: true })
				const xml = await AndroidConfig.Resources.readResourcesXMLAsync({ path: file })
				await XML.writeXMLAsync({
					path: file,
					xml: AndroidConfig.Colors.assignColorValue(xml, { name: COLOUR, value }),
				})
			}
			return mod
		},
	])
}

module.exports = (config) => withWallpaperColours(withWindowBackground(withNightColour(withDayColour(config))))
