// Web twin of sync/account.js: login uses the current window origin as the server URL.
// All other behavior mirrors the native version, storing data via the kv wrapper.

import * as Device from "expo-device"
import { Platform } from "react-native"
import Storage from "../lib/kv"
import { SETTINGS, STATUS, settings } from "./client"

/**
 * Log in (or sign up) — on the web the server URL is fixed to the current
 * origin, so the login form's url field is accepted and let go.
 */
export async function logIn({ url: _url, username, password, create = false }) {
	const base = (window.location.origin || "").trim().replace(/\/+$/, "")
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

// Same logout logic as native – clears stored keys.
export async function logOut() {
	const { url, token } = await settings()
	if (url !== "" && token !== "") {
		try {
			await fetch(`${url}/api/v1/sessions/current`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			})
		} catch {
			// offline – token will be cleared locally anyway
		}
	}
	const keys = [SETTINGS.token, SETTINGS.group, SETTINGS.name, STATUS.lastSync, STATUS.lastError]
	await Promise.all(keys.map((key) => Storage.removeItemAsync(key)))
}

/** Returns the stored account info – on web the URL is always the origin. */
export async function account() {
	const [name] = await Promise.all([Storage.getItemAsync(SETTINGS.name)])
	return { url: window.location.origin, name: name ?? null }
}

function deviceName() {
	if (Platform.OS === "web") return "web"
	return Device.modelName ?? Platform.OS
}
