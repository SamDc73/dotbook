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

// Web Locks — and the OPFS the database lives in — are secure-context APIs.
// On plain http that is not localhost, `navigator.locks` is undefined and the
// database could never open; say so plainly instead of crashing on import.
const SECURE = typeof navigator !== "undefined" && "locks" in navigator

// Requested once per page load, never per mount. The callback holds the lock
// by never settling; `acquired` is how the component learns it has it. Only a
// secure context may touch navigator.locks at all.
const NEVER = new Promise(() => undefined)
const acquired = SECURE
	? new Promise((resolve) => {
			navigator.locks.request(LOCK, () => {
				resolve()
				return NEVER
			})
		})
	: null

export function DatabaseGate({ children }) {
	if (!SECURE) return <NeedsHttps />
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

// Plain HTTP on a LAN box: the log is safe — browsers simply refuse the
// browser-side database the whole web app stands on. Android, sync, MCP and
// the extension are unaffected; only this browser tab cannot host the log.
function NeedsHttps() {
	return (
		<View className="flex-1 items-center justify-center gap-sm bg-background px-lg">
			<Text variant="subheading">Needs HTTPS</Text>
			<Text className="text-center text-on-surface-variant">
				Dotbook keeps the log in this browser’s own storage, and browsers only allow that in a secure context. Open
				this over https:// or on localhost — the server speaks TLS itself once TLS_CERT and TLS_KEY are set.
			</Text>
		</View>
	)
}
