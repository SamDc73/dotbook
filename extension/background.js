// Dotbook browser-time collector. Phase 10.
//
// Measures ACTIVE time per site (focused window + non-idle), batches it, and
// POSTs to the server. Per V0.1.md it is a breakdown of the browser's own app
// time, never a sibling of it — the server must not add the two together.
