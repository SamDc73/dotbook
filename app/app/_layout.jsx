import { Stack } from "expo-router"
import { SQLiteProvider } from "expo-sqlite"
import { Suspense } from "react"
import { ActivityIndicator } from "react-native"
import { migrate } from "../db/migrate"
import "../global.css"

export default function RootLayout() {
	return (
		<Suspense fallback={<ActivityIndicator className="flex-1 bg-background text-primary" />}>
			<SQLiteProvider
				databaseName="dotbook.db"
				options={{ enableChangeListener: true }}
				onInit={migrate}
				useSuspense
			>
				<Stack screenOptions={{ headerShown: false }} />
			</SQLiteProvider>
		</Suspense>
	)
}
