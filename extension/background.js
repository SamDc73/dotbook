// Dotbook browser-time collector. Phase 10.
//
// Measures ACTIVE time per site — the focused window's active tab, while the
// user is not idle — and POSTs it to the server every few minutes. Per V0.1
// it is a breakdown of the browser's own app time, never a sibling of it: the
// server must not add these seconds to Android's UsageStats figure for Firefox.
//
// This is an MV3 event page. Firefox unloads it whenever it is idle (and on
// Android there is no persistent page at all), so nothing here may live in a
// module variable between events: the open interval sits in storage.session
// and the unsent seconds in storage.local.

const browser = globalThis.browser // Firefox's promise-based WebExtension API
const FLUSH_ALARM = "flush"
const FLUSH_MINUTES = 5
const IDLE_SECONDS = 60

// ---------------------------------------------------------------- intervals

// One interval is open at a time: the site being looked at, and since when.
// Every transition closes it, banks its seconds, and may open a new one.

async function open(url) {
	await close()
	const site = siteOf(url)
	if (site === null) return
	await browser.storage.session.set({ current: { site, since: Date.now() } })
}

async function close() {
	const { current } = await browser.storage.session.get("current")
	if (!current) return
	await browser.storage.session.remove("current")

	// Whole seconds; the remainder is lost, which is under a second per transition.
	const seconds = Math.floor((Date.now() - current.since) / 1000)
	if (seconds === 0) return
	// Attributed to the day the interval started. Intervals are at most one
	// flush period long, so the error at midnight is bounded by FLUSH_MINUTES.
	const key = `${localDay(new Date(current.since))}|${current.site}`
	const { buckets = {} } = await browser.storage.local.get("buckets")
	buckets[key] = (buckets[key] ?? 0) + seconds
	await browser.storage.local.set({ buckets })
}

// `https://www.example.com/a?b` → `example.com`; null for pages that are not sites.
function siteOf(url) {
	if (!url || !/^https?:/.test(url)) return null
	return new URL(url).hostname.replace(/^www\./, "")
}

function localDay(date) {
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	return `${date.getFullYear()}-${month}-${day}`
}

// The tab the user is looking at right now, or null. Firefox for Android has no
// `windows` API, so there the active tab of the only window is the answer.
async function activeTab() {
	const query = browser.windows ? { active: true, lastFocusedWindow: true } : { active: true }
	const [tab] = await browser.tabs.query(query)
	return tab ?? null
}

async function reopenActiveTab() {
	const state = await browser.idle.queryState(IDLE_SECONDS)
	if (state !== "active") return close()
	const tab = await activeTab()
	return tab ? open(tab.url) : close()
}

// ------------------------------------------------------------------ events

// Handlers are async and Firefox fires events back to back, so they are run
// one after another; two interleaved close() calls would bank the same seconds twice.
let chain = Promise.resolve()
function serial(handler) {
	return (...args) => {
		chain = chain
			.then(() => handler(...args))
			.catch(() => {
				// A failed handler must not stall every later event; the next one re-reads storage anyway.
			})
		return chain
	}
}

browser.tabs.onActivated.addListener(serial(reopenActiveTab))

browser.tabs.onUpdated.addListener(
	serial(async (_tabId, change, tab) => {
		if (change.url && tab.active) await reopenActiveTab()
	}),
	{ properties: ["url"] }
)

if (browser.windows) {
	browser.windows.onFocusChanged.addListener(
		serial((windowId) => (windowId === browser.windows.WINDOW_ID_NONE ? close() : reopenActiveTab()))
	)
}

browser.idle.onStateChanged.addListener(serial((state) => (state === "active" ? reopenActiveTab() : close())))

browser.alarms.onAlarm.addListener(
	serial(async (alarm) => {
		if (alarm.name !== FLUSH_ALARM) return
		await close()
		await reopenActiveTab()
		await send()
	})
)

// Firefox fires this before unloading the event page (since 106).
browser.runtime.onSuspend.addListener(serial(close))

// The options page asks for a manual send and wants the outcome back.
browser.runtime.onMessage.addListener((message) => {
	if (message?.type !== "flush") return undefined
	return serial(async () => {
		await close()
		await reopenActiveTab()
		await send()
		return browser.storage.local.get(["lastSentAt", "lastError"])
	})()
})

async function start() {
	browser.idle.setDetectionInterval(IDLE_SECONDS)
	await browser.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_MINUTES })
	await reopenActiveTab()
}
browser.runtime.onInstalled.addListener(serial(start))
browser.runtime.onStartup.addListener(serial(start))

// -------------------------------------------------------------------- send

// The server ADDS the seconds it receives to its (day, source, device, site)
// rollup, so every second must be sent exactly once: the snapshot is subtracted
// from the buckets only after a 2xx. A response lost on the wire would make a
// retry double-count — hence small, frequent batches instead of an idempotency
// scheme in V0.1.
async function send() {
	const { settings, buckets = {} } = await browser.storage.local.get(["settings", "buckets"])
	const snapshot = { ...buckets }
	if (!settings?.serverUrl || !settings.token || Object.keys(snapshot).length === 0) return

	const rollups = Object.entries(snapshot).map(([key, seconds]) => {
		const [day, site] = key.split("|")
		return { day, site, seconds }
	})

	try {
		const response = await fetch(`${settings.serverUrl}/api/v1/browser-time`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.token}` },
			body: JSON.stringify({ source: "ext:firefox", device: settings.device, rollups }),
		})
		if (!response.ok) throw new Error(`server said ${response.status}`)
		await subtract(snapshot)
		await browser.storage.local.set({ lastSentAt: Date.now(), lastError: null })
	} catch (error) {
		// Offline is normal — the server is optional. The seconds stay and go next time.
		await browser.storage.local.set({ lastError: error.message })
	}
}

// Seconds banked while the request was in flight are kept for the next send.
async function subtract(sent) {
	const { buckets = {} } = await browser.storage.local.get("buckets")
	for (const [key, seconds] of Object.entries(sent)) {
		const left = (buckets[key] ?? 0) - seconds
		if (left > 0) buckets[key] = left
		else delete buckets[key]
	}
	await browser.storage.local.set({ buckets })
}
