const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)
// Resolve @dotbook/core from the workspace root.
config.watchFolders = [require("node:path").resolve(__dirname, "..")]

module.exports = withNativeWind(config, { input: "./global.css" })
