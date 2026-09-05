# Dotbook browser-time extension

Firefox WebExtension (MV3). Same code targets desktop and Firefox for Android.

Records **active** time per site — focused window, not idle — batches it, and POSTs
to your server. Requires the self-hosted server; there is nowhere else to send it.

## Double-count rule

Android UsageStats already reports Firefox's total app time. The per-site figures
here are a **breakdown of** that total, never additional rows. Adding them together
double-counts every minute spent in the browser.
