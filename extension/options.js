// Settings page: where to send, and a way to send now.

const browser = globalThis.browser // Firefox's promise-based WebExtension API
const FIELDS = ["serverUrl", "token", "device"]

const form = document.getElementById("settings")
const status = document.getElementById("status")
const error = document.getElementById("error")

async function load() {
	const {
		settings = {},
		lastSentAt,
		lastError,
	} = await browser.storage.local.get(["settings", "lastSentAt", "lastError"])
	for (const field of FIELDS) {
		document.getElementById(field).value = settings[field] ?? ""
	}
	if (!settings.device) {
		const platform = await browser.runtime.getPlatformInfo()
		document.getElementById("device").value = `Firefox on ${platform.os}`
	}
	show({ lastSentAt, lastError })
}

function show({ lastSentAt, lastError }) {
	status.textContent = lastSentAt ? `Last sent ${new Date(lastSentAt).toLocaleString()}` : "Nothing sent yet"
	error.textContent = lastError ?? ""
}

// Saving is the user action that lets us ask for the one origin we need.
// The manifest declares "*://*/*" as *optional* so the request can name just
// this server; nothing is granted until this button is pressed.
form.addEventListener("submit", async (event) => {
	event.preventDefault()
	const settings = {}
	for (const field of FIELDS) {
		settings[field] = document.getElementById(field).value.trim().replace(/\/+$/, "")
	}
	const origin = `${new URL(settings.serverUrl).origin}/*`
	const granted = await browser.permissions.request({ origins: [origin] })
	if (!granted) {
		error.textContent = `Permission to contact ${origin} was not granted; nothing saved.`
		return
	}
	await browser.storage.local.set({ settings })
	status.textContent = "Saved"
	error.textContent = ""
})

document.getElementById("send").addEventListener("click", async () => {
	status.textContent = "Sending…"
	show(await browser.runtime.sendMessage({ type: "flush" }))
})

load()
