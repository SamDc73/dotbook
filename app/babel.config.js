module.exports = (api) => {
	api.cache(true)
	return {
		presets: ["babel-preset-expo"],
		overrides: [
			{
				// NativeWind 5's preset (react-native-css) rewrites every `react-native`
				// import into its CSS wrappers — including react-native-web's OWN internal
				// imports (its Animated.FlatList imports ../exports/FlatList). That wrapper
				// then requires `react-native` while react-native-web is still initialising,
				// so on web the FlatList getter returns undefined and the app never starts.
				// Excluding react-native-web from the preset keeps the rewrite for our code
				// and every other library. The preset also carries react-native-worklets/plugin
				// (Reanimated 4), so it is not listed twice.
				// A function, not a RegExp: Expo computes its transform cache key by loading
				// this config with no filename, and Babel refuses a pattern in that case.
				exclude: (filename) => filename !== undefined && /node_modules[\\/]react-native-web[\\/]/.test(filename),
				presets: ["nativewind/babel"],
			},
		],
	}
}
