// Feature 11 — notifications on the web, tab open.
//
// Tab open: the Notifications API below, no server, no push, works offline.
//
// Tab or browser closed is NOT covered here and is deliberately server-side
// config, not app code (V0.1 → feature 11):
//   1. Web Push (RFC 8030) via ntfy, which already carries Android through
//      UnifiedPush — one push path for both surfaces.
//   2. `ntfy webpush keys` generates the VAPID keypair; set the `web-push-*`
//      options in ntfy's config.
//   3. The ntfy web app installs as a PWA on Firefox and shows the push.
//   4. Both Notifications and Push need a secure context: HTTPS or localhost.
//      Self-hosting therefore needs real TLS (Caddy, or a Tailscale cert).
//   Escape hatch if ntfy is ever dropped: `@block65/webcrypto-web-push` from
//   the Bun server.

const MAX_DELAY_MS = 24 * 60 * 60 * 1000 // setTimeout overflows past ~24.8 days; reconcile re-arms daily anyway
const timers = new Set()

export function hasNotifications() {
	return typeof Notification !== "undefined"
}

// Browsers only grant from a user gesture, so call this from a button, never on load.
export async function requestPermission() {
	if (!hasNotifications()) return false
	if (Notification.permission === "granted") return true
	return (await Notification.requestPermission()) === "granted"
}

export function clearAll() {
	for (const timer of timers) clearTimeout(timer)
	timers.clear()
}

// Fire a notification at `ts` (epoch ms). Past times and times beyond a day are
// skipped: reconcile runs on every load, so tomorrow's are armed tomorrow.
export function notifyAt(ts, title, body) {
	if (!hasNotifications() || Notification.permission !== "granted") return
	const delay = ts - Date.now()
	if (delay < 0 || delay > MAX_DELAY_MS) return

	const timer = setTimeout(() => {
		timers.delete(timer)
		const shown = new Notification(title, { body, tag: `${title}@${ts}` })
		shown.onclick = () => {
			window.focus()
			shown.close()
		}
	}, delay)
	timers.add(timer)
}
