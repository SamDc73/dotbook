const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)
// Resolve @dotbook/core from the workspace root.
config.watchFolders = [require("node:path").resolve(__dirname, "..")]

// expo-sqlite on web runs SQLite as `wa-sqlite.wasm` inside a Worker.
config.resolver.assetExts.push("wasm")
// Its synchronous API needs SharedArrayBuffer, which browsers only allow under
// these two headers. The dev server sets them here; a real host must set them too.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
	res.setHeader("Cross-Origin-Embedder-Policy", "credentialless")
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin")
	middleware(req, res, next)
}

module.exports = withNativeWind(config, { input: "./global.css" })
