const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)
// Resolve @dotbook/core from the workspace root.
config.watchFolders = [require("node:path").resolve(__dirname, "..")]

// expo-sqlite ships `wa-sqlite.wasm` for its web build. The web app never opens
// a database (it is a client of the server), but the package is still in the
// web bundle's import graph — _layout.jsx imports it for the native branch.
config.resolver.assetExts.push("wasm")

module.exports = withNativeWind(config, { input: "./global.css" })
