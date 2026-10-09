// The MCP endpoint, /api/v1/mcp: AI tools read and write the log over the
// official SDK's Streamable HTTP, both protocol eras, a fresh server per
// request. An MCP token's scope picks the tools; a device token is refused,
// and an MCP token cannot sync.

import {
	createMcpHandler,
	McpServer,
	OAuthError,
	OAuthErrorCode,
	originValidationResponse,
	requireBearerAuth,
} from "@modelcontextprotocol/server"
// Bun imports JSON as a module by itself; no import attribute needed.
import packageJson from "../../package.json"
import { MCP_INSTRUCTIONS } from "../ai/prompts.js"
import { tokenOwner } from "../db/accounts.js"
import { registerDayTools } from "./tools/day.js"
import { registerHabitTools } from "./tools/habits.js"
import { registerLogTools } from "./tools/log.js"
import { registerPassiveTools } from "./tools/passive.js"
import { registerRecurringTools } from "./tools/recurring.js"
import { registerTemplateTools } from "./tools/templates.js"
import { registerTodoTools } from "./tools/todos.js"

const READ = "read"
const WRITE = "write"
const HOUR_S = 60 * 60

/**
 * The Hono handler for `/api/v1/mcp`.
 * @param {{ accounts: import("@dotbook/core/sync").SyncDb,
 *           databaseFor: (userId: string) => Promise<import("@dotbook/core/sync").SyncDb>,
 *           corsOrigins: string[] }} options
 */
export function mcpRoute({ accounts, databaseFor, corsOrigins }) {
	const gate = requireBearerAuth({ verifier: { verifyAccessToken: (token) => grantFor(accounts, token) } })
	const handler = createMcpHandler(async ({ authInfo }) => {
		const userId = authInfo.extra.userId
		return buildServer({ db: await databaseFor(userId), groupId: userId, canWrite: authInfo.scopes.includes(WRITE) })
	})
	// MCP clients outside a browser send no Origin and pass. A browser page may
	// call only from the web app's own origins — the DNS-rebinding guard the
	// spec asks for.
	const origins = corsOrigins.map((origin) => new URL(origin).hostname)

	return async (c) => {
		const request = c.req.raw
		const refused = originValidationResponse(request, origins)
		if (refused) return refused
		const auth = await gate(request)
		if (auth instanceof Response) return auth
		return handler.fetch(request, { authInfo: auth })
	}
}

// Registration order is the order `tools/list` returns — the same every time, as
// the spec asks: a whole day first, then each part of the app.
function buildServer({ db, groupId, canWrite }) {
	const server = new McpServer(
		{ name: "dotbook", title: "Dotbook", version: packageJson.version },
		{ instructions: MCP_INSTRUCTIONS }
	)
	const context = { db, groupId, canWrite }
	registerDayTools(server, context)
	registerLogTools(server, context)
	registerTodoTools(server, context)
	registerHabitTools(server, context)
	registerTemplateTools(server, context)
	registerRecurringTools(server, context)
	registerPassiveTools(server, context)
	return server
}

async function grantFor(accounts, token) {
	const owner = await tokenOwner(accounts, token)
	if (!owner?.scope.startsWith("mcp:")) {
		throw new OAuthError(OAuthErrorCode.InvalidToken, "Unknown token")
	}
	// A token has no expiry of its own, but the SDK's gate insists on one: each
	// request's grant runs an hour from now, and every request checks again.
	return {
		token,
		clientId: owner.user.name,
		scopes: owner.scope === "mcp:write" ? [READ, WRITE] : [READ],
		expiresAt: Math.floor(Date.now() / 1000) + HOUR_S,
		extra: { userId: owner.user.id },
	}
}
