// Users with a password (argon2id, Bun's built-in) and the tokens they hold:
// random, shown once, stored as SHA-256, one scope each (device, mcp:read,
// mcp:write), revocable. Lives in accounts.sqlite, apart from users' data.

import { createHash, randomBytes } from "node:crypto"
import { password as passwords } from "bun"
import { uuidv7 } from "uuidv7"

export const SCOPES = ["device", "mcp:read", "mcp:write"]
const NAME = /^[a-z0-9][a-z0-9._-]{1,31}$/i
export const DEFAULT_MIN_PASSWORD = 8
// Checked when the name does not exist, so a wrong name takes as long as a wrong password.
const NOBODY = await passwords.hash("nobody")

/** A refusal the HTTP layer can pass straight on. */
export class AccountError extends Error {
	constructor(status, message) {
		super(message)
		this.status = status
	}
}

export async function ensureAccountTables(db) {
	await db.run(`CREATE TABLE IF NOT EXISTS users (
		id            TEXT    PRIMARY KEY,
		name          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
		password_hash TEXT    NOT NULL,
		created_at    INTEGER NOT NULL
	)`)
	await db.run(`CREATE TABLE IF NOT EXISTS tokens (
		id           TEXT    PRIMARY KEY,
		user_id      TEXT    NOT NULL REFERENCES users (id),
		hash         TEXT    NOT NULL UNIQUE,
		scope        TEXT    NOT NULL,
		label        TEXT    NOT NULL,
		created_at   INTEGER NOT NULL,
		last_used_at INTEGER,
		revoked_at   INTEGER
	)`)
}

export async function userCount(db) {
	return (await db.get("SELECT count(*) AS n FROM users")).n
}

export function users(db) {
	return db.all("SELECT id, name, created_at FROM users ORDER BY created_at")
}

export function userByName(db, name) {
	return db.get("SELECT id, name, created_at FROM users WHERE name = ?", [name])
}

/**
 * @param {{ name: string, password: string, minPassword?: number }} user  `minPassword` is the server's
 *   rule (MIN_PASSWORD_LENGTH); the default is for tests and a sensible server.
 * @returns the new user `{ id, name, created_at }`; throws an AccountError when it cannot be made
 */
export async function createUser(db, { name, password, minPassword = DEFAULT_MIN_PASSWORD }) {
	if (typeof name !== "string" || !NAME.test(name)) {
		throw new AccountError(400, "a username is 2–32 letters, digits, dots, dashes or underscores")
	}
	if (typeof password !== "string" || password.length < minPassword) {
		throw new AccountError(400, `a password is at least ${minPassword} characters`)
	}
	if (await userByName(db, name)) {
		throw new AccountError(409, "that username is taken")
	}
	const user = { id: uuidv7(), name, created_at: Date.now() }
	await db.run("INSERT INTO users (id, name, password_hash, created_at) VALUES (?, ?, ?, ?)", [
		user.id,
		user.name,
		await passwords.hash(password),
		user.created_at,
	])
	return user
}

/** The user when name and password match, else null — taking the same time either way. */
export async function authenticate(db, name, password) {
	const row = await db.get("SELECT id, name, password_hash FROM users WHERE name = ?", [String(name ?? "")])
	const matches = await passwords.verify(String(password ?? ""), row?.password_hash ?? NOBODY)
	return matches && row ? { id: row.id, name: row.name } : null
}

/** A new token for `userId`. The plain token is returned once and never stored. */
export async function issueToken(db, userId, scope, label) {
	if (!SCOPES.includes(scope)) {
		throw new AccountError(400, `a scope is one of ${SCOPES.join(", ")}`)
	}
	const token = randomBytes(32).toString("base64url")
	const id = uuidv7()
	await db.run("INSERT INTO tokens (id, user_id, hash, scope, label, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
		id,
		userId,
		digest(token),
		scope,
		label,
		Date.now(),
	])
	return { id, token }
}

/** Who presents `token`: `{ user, scope, tokenId }`, or null when it is unknown or revoked. */
export async function tokenOwner(db, token) {
	if (typeof token !== "string" || token === "") {
		return null
	}
	const row = await db.get(
		`SELECT t.id AS token_id, t.scope, u.id, u.name FROM tokens t JOIN users u ON u.id = t.user_id
		WHERE t.hash = ? AND t.revoked_at IS NULL`,
		[digest(token)]
	)
	if (!row) {
		return null
	}
	await db.run("UPDATE tokens SET last_used_at = ? WHERE id = ?", [Date.now(), row.token_id])
	return { user: { id: row.id, name: row.name }, scope: row.scope, tokenId: row.token_id }
}

export function revokeToken(db, id) {
	return db.run("UPDATE tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [Date.now(), id])
}

export function tokensOf(db, userId) {
	return db.all(
		"SELECT id, scope, label, created_at, last_used_at, revoked_at FROM tokens WHERE user_id = ? ORDER BY created_at",
		[userId]
	)
}

function digest(token) {
	return createHash("sha256").update(token).digest("hex")
}
