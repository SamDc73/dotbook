// expo-notifications, for Android. Metro picks `native.web.js` on the web
// instead, so the browser bundle never loads the library (it has no scheduling
// there and warns on import). Every notification call in the app goes through
// this module, never through "expo-notifications" directly.
export * from "expo-notifications"
