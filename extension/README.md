# Dotbook browser-time extension

Firefox WebExtension (MV3, Firefox 140+ / Android 142+ — the manifest declares what data is collected, which older versions do not understand). The same files run on desktop and on
Firefox for Android — no build step, load the directory as it is.

Records **active** time per site — the focused window's active tab, while you are
not idle — and POSTs it to your server every five minutes. Requires the
self-hosted server; there is nowhere else to send it. Offline is normal: unsent
seconds wait in the extension's local storage.

## Double-count rule

Android UsageStats already reports Firefox's total app time. The per-site figures
here are a **breakdown of** that total, never additional rows. Adding them together
double-counts every minute spent in the browser.

## What is sent

`POST {server}/api/v1/browser-time`, `Authorization: Bearer {token}`:

```json
{ "source": "ext:firefox", "device": "Firefox on linux",
  "rollups": [ { "day": "2026-09-10", "site": "example.com", "seconds": 123 } ] }
```

`day` is the browser's local date. Hostnames only (`www.` stripped) — no paths,
no titles. `about:`, `file:` and extension pages are never counted. The server
*adds* each batch to its rollup, so a batch is dropped locally only after a 2xx.

## Permissions

`tabs` (to read the active tab's URL), `idle`, `alarms`, `storage`. No site is
contacted until you save the settings: the manifest lists `*://*/*` as an
*optional* host permission and the Save button requests only your server's
origin, so the grant you see names one host. A stricter fixed list would need
the server address baked into the manifest.

## Load it

- **Desktop:** `about:debugging` → *This Firefox* → *Load Temporary Add-on…* →
  pick `manifest.json`. Then open the extension's *Preferences* (settings page),
  fill in server, token, device name, Save.
- **Android:** `bunx web-ext run --target=firefox-android --android-device=<id>`
  (needs `adb` and Firefox Nightly/Beta with remote debugging), or publish it to
  your own AMO *custom collection* and enable that collection in Firefox's
  secret settings menu.
