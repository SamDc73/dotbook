// Accounts from the shell — the way in when sign-up is closed, and the only
// way to mint an MCP token.
//
//   bun src/cli.js user add sam                 asks for the password
//   bun src/cli.js user list
//   bun src/cli.js token add sam --scope mcp:write --label "claude code"
//   bun src/cli.js token list sam
//   bun src/cli.js token revoke <id>
//
// In Docker: `docker compose exec server bun src/cli.js …`.

import { join } from "node:path"
import { createInterface } from "node:readline/promises"
import { Command } from "commander"
import { CONFIG } from "./config.js"
import {
	AccountError,
	createUser,
	ensureAccountTables,
	issueToken,
	revokeToken,
	SCOPES,
	tokensOf,
	userByName,
	users,
} from "./db/accounts.js"
import { openDatabase } from "./db/adapter.js"

const accounts = openDatabase(join(CONFIG.dataDir, "accounts.sqlite"))
await ensureAccountTables(accounts)

const program = new Command().name("dotbook").description("Users and tokens on this Dotbook server")
const user = program.command("user").description("the people with an account")
const token = program.command("token").description("what a device or an AI tool sends")

user
	.command("add <name>")
	.description("create a user")
	.option("-p, --password <password>", "the password; asked for when left out")
	.action(async (name, options) => {
		const password = options.password ?? (await ask("password: "))
		const created = await createUser(accounts, { name, password, minPassword: CONFIG.minPassword })
		console.log(`created ${created.name} (${created.id})`)
	})

user
	.command("list")
	.description("every user")
	.action(async () => {
		for (const row of await users(accounts)) {
			console.log(`${row.name}\t${row.id}\tsince ${new Date(row.created_at).toISOString().slice(0, 10)}`)
		}
	})

token
	.command("add <user>")
	.description("mint a token; it is shown once")
	.requiredOption("-s, --scope <scope>", `one of ${SCOPES.join(", ")}`)
	.option("-l, --label <label>", "what will hold it", "cli")
	.action(async (name, options) => {
		const owner = await mustFind(name)
		const minted = await issueToken(accounts, owner.id, options.scope, options.label)
		console.log(minted.token)
		console.error(`token ${minted.id} for ${owner.name}, scope ${options.scope} — shown once, store it now`)
	})

token
	.command("list <user>")
	.description("a user's tokens, revoked ones included")
	.action(async (name) => {
		const owner = await mustFind(name)
		for (const row of await tokensOf(accounts, owner.id)) {
			let state = "never used"
			if (row.revoked_at) state = "revoked"
			else if (row.last_used_at) state = `last used ${new Date(row.last_used_at).toISOString()}`
			console.log(`${row.id}\t${row.scope}\t${row.label}\t${state}`)
		}
	})

token
	.command("revoke <id>")
	.description("stop a token working")
	.action(async (id) => {
		await revokeToken(accounts, id)
		console.log(`revoked ${id}`)
	})

async function mustFind(name) {
	const found = await userByName(accounts, name)
	if (!found) {
		throw new AccountError(404, `no user named ${name}`)
	}
	return found
}

// Typed in the open — pass --password from a secret store when that matters.
async function ask(question) {
	const readline = createInterface({ input: process.stdin, output: process.stdout })
	try {
		return await readline.question(question)
	} finally {
		readline.close()
	}
}

try {
	await program.parseAsync()
} catch (error) {
	if (!(error instanceof AccountError)) {
		throw error
	}
	console.error(error.message)
	process.exit(1)
}
