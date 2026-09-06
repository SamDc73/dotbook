module.exports = (api) => {
	api.cache(true)
	return {
		// NativeWind 5 handles JSX via its babel preset — no jsxImportSource
		// (that was v4; `nativewind/jsx-runtime` does not exist in v5).
		presets: ["babel-preset-expo", "nativewind/babel"],
		// react-native-worklets/plugin must stay last (Reanimated 4 requirement).
		plugins: ["react-native-worklets/plugin"],
	}
}
