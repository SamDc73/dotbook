// The key-value store, behind a lib import so the web build can swap in
// kv.web.js the way it swaps saveFile (platform resolution picks the .web
// twin). Native: expo-sqlite's AsyncStorage drop-in, unchanged.
export { default } from "expo-sqlite/kv-store"
