import * as Device from "expo-device"
import Storage from "expo-sqlite/kv-store"
import { Platform } from "react-native"
import { SETTINGS, STATUS, settings } from "./client"

// Logging in and out. A login is a device token from the server, kept in
// kv-store beside the server's URL and the user's group; from then on every
// sync carries it. The app never holds the password, and it works with none
// of this set — the log is local; logging in is what turns sync on.

/**
 * Log in, or with `create` sign up — the same form, and the server says no
 * when sign-up is closed. Resolves to the user; throws with the server's
 * reason otherwise.
 */
export async function logIn({ url, username, password, create = false }) {
	const base = url.trim().replace(/\/+$/, "")
	const response = await fetch(`${base}/api/v1/${create ? "users" : "sessions"}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: username.trim(), password, device: deviceName() }),
	})
	const body = await response.json().catch(() => ({}))
	if (!response.ok) {
		throw new Error(body.error ?? `server answered ${response.status}`)
	}
	await Promise.all([
		Storage.setItemAsync(SETTINGS.url, base),
		Storage.setItemAsync(SETTINGS.token, body.token),
		Storage.setItemAsync(SETTINGS.group, body.groupId),
		Storage.setItemAsync(SETTINGS.name, body.user.name),
		Storage.removeItemAsync(STATUS.lastError),
	])
	return body.user
}

// The server forgets the token first, then this device does. A server that
// cannot be reached is no reason to stay logged in; the URL stays for next time.
export async function logOut() {
	const { url, token } = await settings()
	if (url !== "" && token !== "") {
		try {
			await fetch(`${url}/api/v1/sessions/current`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
		} catch {
			// Offline: the token dies here anyway, and the server's copy is revoked next time it is seen.
		}
	}
	const keys = [SETTINGS.token, SETTINGS.group, SETTINGS.name, STATUS.lastSync, STATUS.lastError]
	await Promise.all(keys.map((key) => Storage.removeItemAsync(key)))
}

/** Where this device is logged in, and as whom; `name` is null when it is not. */
export async function account() {
	const [url, name] = await Promise.all([Storage.getItemAsync(SETTINGS.url), Storage.getItemAsync(SETTINGS.name)])
	return { url: url ?? "", name: name ?? null }
}

// The label the token carries on the server, so a list of tokens reads as a list of devices.
function deviceName() {
	if (Platform.OS === "web") return "web"
	return Device.modelName ?? Platform.OS
}
