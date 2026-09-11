import { uuidv7 } from "uuidv7"

// One row per kept recording, pointing at the line it was transcribed into.
// Local only — audio files do not sync in V0.1; the transcript is the line's text.
export function saveVoiceNote(db, { entryId, uri, durationMs, engine }) {
	return db.sql`INSERT INTO voice_notes (id, entry_id, path, duration_ms, engine, created_at)
		VALUES (${uuidv7()}, ${entryId}, ${uri}, ${durationMs}, ${engine}, ${Date.now()})`
}
