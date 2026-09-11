import { Suspense, use, useEffect, useState } from "react"
import { View } from "react-native"
import { Text } from "../components/ui/Text"

// Web only (Metro picks this file by platform; DatabaseGate.jsx is the
// pass-through for native). expo-sqlite keeps the database in OPFS through
// wa-sqlite's AccessHandlePoolVFS, which allows ONE open connection per origin:
// a second tab throws NoModificationAllowedError from the worker and stays
// blank. So a tab takes a Web Lock before opening, holds it for its lifetime,
// and the next tab waits for it — with a message — instead of crashing.
const LOCK = "dotbook-db"

// Requested once per page load, never per mount. The callback holds the lock
// by never settling; `acquired` is how the component learns it has it.
const NEVER = new Promise(() => undefined)
const acquired = new Promise((resolve) => {
	navigator.locks.request(LOCK, () => {
		resolve()
		return NEVER
	})
})

export function DatabaseGate({ children }) {
	return (
		<Suspense fallback={<Waiting />}>
			<Locked>{children}</Locked>
		</Suspense>
	)
}

function Locked({ children }) {
	use(acquired)
	return children
}

// Silent for the first moment — the lock is normally granted at once — then
// says what is happening. The wait ends by itself when the other tab closes.
function Waiting() {
	const [late, setLate] = useState(false)
	useEffect(() => {
		const handle = setTimeout(() => setLate(true), 800)
		return () => clearTimeout(handle)
	}, [])
	if (!late) return null
	return (
		<View className="flex-1 items-center justify-center gap-sm bg-background px-lg">
			<Text variant="subheading">Open in another tab</Text>
			<Text className="text-center text-on-surface-variant">
				The log is already open in another tab of this browser. Close that tab, or use it — this one continues on its
				own once it is free.
			</Text>
		</View>
	)
}
