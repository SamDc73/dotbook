// Web twin of voice/notes.js. A voice note row points a line at its audio on
// the device that recorded it (local only — audio never syncs). The browser
// keeps no audio and no database: the transcript already is the line's text,
// written with `source: "voice"`, so there is nothing more to keep.
export function saveVoiceNote() {
	return Promise.resolve()
}
