import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ScreenHeader } from "../components/ScreenHeader"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Panel } from "../components/ui/Panel"
import { Text } from "../components/ui/Text"
import { account, logIn } from "../sync/account"
import { syncNow } from "../sync/client"

// Server URL, username, password → a device token, the only thing the app
// keeps. "Create account" is the same form; the server refuses when sign-up
// is closed. Reached from Settings, never forced: the log works offline.
export default function Login() {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const { data: known } = useQuery({ queryKey: ["account"], queryFn: account })
	const [url, setUrl] = useState(null)
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)

	// The last server this device used is offered back; typing replaces it.
	const serverUrl = url ?? known?.url ?? ""
	const ready = serverUrl.trim() !== "" && username.trim() !== "" && password !== "" && !busy

	function back() {
		if (router.canGoBack()) {
			router.back()
		} else {
			router.replace("/settings")
		}
	}

	async function submit(create) {
		setBusy(true)
		setError(null)
		try {
			await logIn({ url: serverUrl, username, password, create })
			await queryClient.invalidateQueries({ queryKey: ["account"] })
			syncNow(db)
			back()
		} catch (failure) {
			setError(failure.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
			<ScreenHeader
				title="Log in"
				lede="Your server, your name, your password. The app keeps a token, never the password"
				onBack={back}
			/>
			<ScrollView contentContainerClassName="gap-md p-md" keyboardShouldPersistTaps="handled">
				<Panel eyebrow="Server">
					<Field
						label="URL"
						value={serverUrl}
						onChangeText={setUrl}
						placeholder="https://life.example.com"
						keyboardType="url"
						textContentType="URL"
					/>
					<Field
						label="Username"
						value={username}
						onChangeText={setUsername}
						textContentType="username"
						autoComplete="username"
					/>
					<Field
						label="Password"
						value={password}
						onChangeText={setPassword}
						secureTextEntry
						textContentType="password"
						autoComplete="current-password"
						returnKeyType="go"
						onSubmitEditing={() => ready && submit(false)}
					/>
					{error === null ? null : (
						<Text variant="caption" className="text-error">
							{error}
						</Text>
					)}
					<View className="flex-row flex-wrap items-center gap-sm">
						<Button onPress={() => submit(false)} disabled={!ready}>
							<Text>Log in</Text>
						</Button>
						<Button variant="outlined" onPress={() => submit(true)} disabled={!ready}>
							<Text>Create account</Text>
						</Button>
					</View>
				</Panel>
			</ScrollView>
		</View>
	)
}

function Field({ label, ...input }) {
	return (
		<View className="gap-2xs">
			<Text variant="label" className="text-on-surface-variant">
				{label}
			</Text>
			<Input autoCapitalize="none" autoCorrect={false} {...input} />
		</View>
	)
}
