// Hermes has no `crypto` global: the CRDT clock's node id and uuidv7 need
// `crypto.getRandomValues`. On web the browser's own stays.
import "react-native-get-random-values"
// Custom entry: the background reminder task must exist before the router
// loads, so a headless start (a "Yes" tap with the app closed) finds it.
import "./notifications/task"
import "expo-router/entry"
