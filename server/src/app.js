// The HTTP surface. Built by a factory so tests can hand it an in-memory
// database and a fake classifier.

import { Timestamp } from "@actual-app/crdt"
import { applyMessages, relay } from "@dotbook/core/sync"
import { Hono } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { cors } from "hono/cors"
import { validator } from "hono/validator"
import { classifyDay, classifyStatus, clearRuns, runPending } from "./ai/classify.js"
import { addBrowserTime } from "./ingest/browserTime.js"
import { validateBrowserTime, validateClassify, validateSyncBody } from "./validate.js"

/**
 * @param {{ db: import("@dotbook/core/sync").SyncDb, token: string, corsOrigins: string[],
 *           groupId: string, classifier?: import("./ai/adapter.js").Classifier | null }} options
 */
export function createApp({ db, token, corsOrigins, groupId, classifier = null }) {
	const app = new Hono()

	// Registered before the auth middleware on purpose: a container health
	// check has no token.
	app.get("/api/v1/health", (c) => c.json({ ok: true }))

	app.use("/api/v1/*", cors({ origin: corsOrigins }), bearerAuth({ token }))

	app.post("/api/v1/sync", validator("json", validateSyncBody), async (c) => {
		const body = c.req.valid("json")
		// One person per server in V0.1. Serving several would need one replica
		// and one clock per group; this check is the seam, and all there is.
		if (body.groupId !== groupId) {
			return c.json({ error: "unknown group" }, 403)
		}
		const response = await relay(db, body)
		// Keep the server's replica current for the classifier. A device whose
		// clock is more than the CRDT's drift limit ahead of ours is refused
		// rather than let its timestamps poison every other device's clock.
		try {
			await applyMessages(db, body.messages)
		} catch (error) {
			if (error instanceof Timestamp.ClockDriftError) {
				return c.json({ error: "device clock is too far ahead of the server" }, 409)
			}
			throw error
		}
		return c.json(response)
	})

	app.post("/api/v1/browser-time", validator("json", validateBrowserTime), async (c) => {
		const accepted = await addBrowserTime(db, groupId, c.req.valid("json"))
		return c.json({ accepted })
	})

	app.post("/api/v1/classify", validator("json", validateClassify), async (c) => {
		if (!classifier) {
			return c.json({ error: "no AI provider configured" }, 503)
		}
		const { day, all } = c.req.valid("json")
		if (day) {
			return c.json({ day, ticks: await classifyDay(db, day, groupId, classifier) })
		}
		if (all) {
			await clearRuns(db, classifier)
		}
		// Deferred: answer with the queue length now and classify in the background.
		runPending(db, groupId, classifier)
		return c.json(await classifyStatus(db, classifier))
	})

	app.get("/api/v1/classify/status", async (c) => {
		if (!classifier) {
			return c.json({ error: "no AI provider configured" }, 503)
		}
		return c.json(await classifyStatus(db, classifier))
	})

	return app
}
