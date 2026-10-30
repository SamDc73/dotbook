import Storage from "./kv"

// Simple wrapper around fetch for server API calls.
// All requests are sent to the same origin as the app.

/** Returns the base URL for the server (same origin). */
export const SERVER = () => window.location.origin

/** Whether a session exists at all — polling paths skip the fetch when not. */
export async function hasSession() {
	return (await Storage.getItemAsync("server-token")) !== null
}

/**
 * Perform an API request.
 * @param {string} path - Path relative to the server root, e.g. "/api/v1/lines".
 * @param {{method?: string, body?: any, raw?: boolean}} [options]
 *   method defaults to "GET". body, if provided, is JSON‑encoded.
 *   If raw is true the raw Response object is returned; otherwise JSON is parsed.
 */
export async function api(path, { method = "GET", body = null, raw = false } = {}) {
	if (!(await hasSession())) {
		// No session yet. Only Today bounces to the login page; the other tabs
		// (Settings above all) must stay usable logged out. The throw settles
		// in the caller's query state — no 401 is ever fired at the server.
		if (location.pathname === "/") location.replace("/login")
		throw new Error("No session")
	}
	const token = await Storage.getItemAsync("server-token")
	const url = `${SERVER()}${path}`
	const headers = {
		Accept: "application/json",
	}
	if (token) {
		headers.Authorization = `Bearer ${token}`
	}
	const opts = { method, headers }
	if (body !== null) {
		headers["Content-Type"] = "application/json"
		opts.body = JSON.stringify(body)
	}
	const res = await fetch(url, opts)
	if (res.status === 401) {
		// clear the token and go to the login page — once; re-replacing /login
		// with /login is a reload loop.
		await Storage.removeItemAsync("server-token")
		if (!location.pathname.startsWith("/login")) location.replace("/login")
		throw new Error("Unauthorized")
	}
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`API request failed ${method} ${path}: ${res.status} ${text}`)
	}
	if (raw) return res
	// 204 No Content (deletes, restores) has no body to parse.
	if (res.status === 204) return null
	return res.json()
}
