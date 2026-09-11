// The HTTP surface. Built by a factory so tests can hand it an in-memory database.

import { Timestamp } from "@actual-app/crdt"
import { applyMessages, relay } from "@dotbook/core/sync"
import { Hono } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { cors } from "hono/cors"
import { validator } from "hono/validator"

/**
 * @param {{ db: import("@dotbook/core/sync").SyncDb, token: string, corsOrigins: string[] }} options
 */
export function createApp({ db, token, corsOrigins }) {
	const app = new Hono()

	// Registered before the auth middleware on purpose: a container health
	// check has no token.
	app.get("/api/v1/health", (c) => c.json({ ok: true }))

	app.use("/api/v1/*", cors({ origin: corsOrigins }), bearerAuth({ token }))

	app.post("/api/v1/sync", validator("json", validateSyncBody), (c) => {
		const body = c.req.valid("json")
		const response = relay(db, body)
		// Keep the server's replica current for the classifier. A device whose
		// clock is more than the CRDT's drift limit ahead of ours is refused
		// rather than let its timestamps poison every other device's clock.
		try {
			applyMessages(db, body.messages)
		} catch (error) {
			if (error instanceof Timestamp.ClockDriftError) {
				return c.json({ error: "device clock is too far ahead of the server" }, 409)
			}
			throw error
		}
		return c.json(response)
	})

	return app
}

// The one place request bodies are trusted: everything after this assumes the shape.
function validateSyncBody(value, c) {
	const { groupId, clientId, merkle, messages } = value ?? {}
	const shapeOk =
		typeof groupId === "string" &&
		groupId !== "" &&
		/^[0-9a-f]{16}$/.test(clientId ?? "") &&
		typeof merkle === "object" &&
		merkle !== null &&
		Array.isArray(messages) &&
		messages.every(isMessage)
	if (!shapeOk) {
		return c.json({ error: "expected { groupId, clientId, merkle, messages[] }" }, 400)
	}
	return { groupId, clientId, merkle, messages }
}

function isMessage(message) {
	return (
		typeof message?.dataset === "string" &&
		typeof message.row === "string" &&
		typeof message.column === "string" &&
		"value" in message &&
		typeof message.timestamp === "string" &&
		Timestamp.parse(message.timestamp) !== null
	)
}
