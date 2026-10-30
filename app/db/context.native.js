// The one sanctioned way to get the local database: the same hook expo-sqlite
// gives, re-exported so web can twin this file. Import `useDb` from ./context,
// never `useSQLiteContext` from expo-sqlite — Metro resolves the twin and the
// same component code runs on both platforms.
export { useSQLiteContext as useDb } from "expo-sqlite"
