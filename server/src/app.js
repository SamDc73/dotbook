// The HTTP surface. Built by a factory so tests can hand it in-memory
// databases and a fake classifier.
//
// Who is asking is a token (db/accounts.js): a device token for sync, ingest
// and classification, an MCP token for AI tools. Each user's data is their
// own database, `databaseFor(user.id)`, and a user is their own sync group.

import { Timestamp } from "@actual-app/crdt"
import { applyMessages, relay } from "@dotbook/core/sync"
import { Hono } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { getConnInfo } from "hono/bun"
import { cors } from "hono/cors"
import { validator } from "hono/validator"
import { rateLimiter } from "hono-rate-limiter"
import { classifyDay, classifyStatus, clearRuns, runPending } from "./ai/classify.js"
import {
	AccountError,
	authenticate,
	createUser,
	DEFAULT_MIN_PASSWORD,
	issueToken,
	revokeToken,
	tokenOwner,
	userCount,
} from "./db/accounts.js"
import { addBrowserTime } from "./ingest/browserTime.js"
import { mcpRoute } from "./mcp/handler.js"
import { validateBrowserTime, validateClassify, validateCredentials, validateSyncBody } from "./validate.js"

// Guessing a password is slow by design: this many tries a minute per address.
const LOGIN_TRIES_PER_MINUTE = 10

/**
 * @param {{ accounts: import("@dotbook/core/sync").SyncDb,
 *           databaseFor: (userId: string) => Promise<import("@dotbook/core/sync").SyncDb>,
 *           corsOrigins: string[], signup?: "first"|"open"|"closed",
 *           classifier?: import("./ai/adapter.js").Classifier | null }} options
 */
export function createApp({
	accounts,
	databaseFor,
	corsOrigins,
	signup = "first",
	minPassword = DEFAULT_MIN_PASSWORD,
	classifier = null,
}) {
	const app = new Hono()
	app.use("/api/v1/*", cors({ origin: corsOrigins }))

	// No token: a container health check has none.
	app.get("/api/v1/health", (c) => c.json({ ok: true }))

	async function signupOpen() {
		if (signup === "open") return true
		if (signup === "closed") return false
		return (await userCount(accounts)) === 0
	}

	// A login is a device token: what the app stores and sends from then on.
	async function session(user, device) {
		const { token } = await issueToken(accounts, user.id, "device", device)
		return { token, user: { id: user.id, name: user.name }, groupId: user.id }
	}

	const slow = rateLimiter({
		windowMs: 60 * 1000,
		limit: LOGIN_TRIES_PER_MINUTE,
		keyGenerator: address,
		message: { error: "too many tries — wait a minute" },
	})

	app.post("/api/v1/users", slow, validator("json", validateCredentials), async (c) => {
		if (!(await signupOpen())) {
			return c.json({ error: "sign-up is closed on this server" }, 403)
		}
		const { username, password, device } = c.req.valid("json")
		try {
			const user = await createUser(accounts, { name: username, password, minPassword })
			return c.json(await session(user, device), 201)
		} catch (error) {
			if (error instanceof AccountError) {
				return c.json({ error: error.message }, error.status)
			}
			throw error
		}
	})

	app.post("/api/v1/sessions", slow, validator("json", validateCredentials), async (c) => {
		const { username, password, device } = c.req.valid("json")
		const user = await authenticate(accounts, username, password)
		if (!user) {
			return c.json({ error: "wrong username or password" }, 401)
		}
		return c.json(await session(user, device), 201)
	})

	// AI tools carry MCP tokens; the route checks them itself (mcp/handler.js).
	app.all("/api/v1/mcp", mcpRoute({ accounts, databaseFor, corsOrigins }))

	// Everything below is a device's: its token names the user, and with the user their database.
	app.use(
		"/api/v1/*",
		bearerAuth({
			verifyToken: async (token, c) => {
				const owner = await tokenOwner(accounts, token)
				if (owner?.scope !== "device") return false
				c.set("auth", owner)
				c.set("db", await databaseFor(owner.user.id))
				return true
			},
		})
	)

	app.get("/api/v1/users/current", (c) => c.json(c.get("auth").user))

	app.delete("/api/v1/sessions/current", async (c) => {
		await revokeToken(accounts, c.get("auth").tokenId)
		return c.body(null, 204)
	})

	app.post("/api/v1/sync", validator("json", validateSyncBody), async (c) => {
		const body = c.req.valid("json")
		// A user is their own group; a device claiming another is refused.
		if (body.groupId !== c.get("auth").user.id) {
			return c.json({ error: "unknown group" }, 403)
		}
		const db = c.get("db")
		const response = await relay(db, body)
		// Keep the replica current for the classifier. A device whose clock is
		// more than the CRDT's drift limit ahead of ours is refused rather than
		// let its timestamps poison every other device's clock.
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
		const accepted = await addBrowserTime(c.get("db"), c.get("auth").user.id, c.req.valid("json"))
		return c.json({ accepted })
	})

	app.post("/api/v1/classify", validator("json", validateClassify), async (c) => {
		if (!classifier) {
			return c.json({ error: "no AI provider configured" }, 503)
		}
		const { day, all } = c.req.valid("json")
		const db = c.get("db")
		const userId = c.get("auth").user.id
		if (day) {
			return c.json({ day, ticks: await classifyDay(db, day, userId, classifier) })
		}
		if (all) {
			await clearRuns(db, classifier)
		}
		// Deferred: answer with the queue length now and classify in the background.
		runPending(db, userId, classifier)
		return c.json(await classifyStatus(db, classifier))
	})

	app.get("/api/v1/classify/status", async (c) => {
		if (!classifier) {
			return c.json({ error: "no AI provider configured" }, 503)
		}
		return c.json(await classifyStatus(c.get("db"), classifier))
	})

	return app
}

// The caller's address: what Caddy forwards, else the socket's; in tests, neither.
function address(c) {
	const forwarded = c.req.header("x-forwarded-for")
	if (forwarded) {
		return forwarded.split(",")[0].trim()
	}
	try {
		return getConnInfo(c).remote.address ?? "unknown"
	} catch {
		return "unknown"
	}
}
