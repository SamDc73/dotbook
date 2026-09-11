// Custom entry: the background reminder task must exist before the router
// loads, so a headless start (a "Yes" tap with the app closed) finds it.
import "./notifications/task"
import "expo-router/entry"
