// Every environment variable, read once. Nothing else in the server touches
// process.env. Bun loads `.env` on its own; see `.env.example`.

const env = process.env

export const CONFIG = {
	port: Number(env.PORT ?? 3000),
	token: env.DOTBOOK_TOKEN,
	dbPath: env.DB_PATH ?? "./data/dotbook.sqlite",
	// Browsers allowed to call the API — the web app's origin(s). No wildcard.
	corsOrigins: (env.CORS_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
}

if (!CONFIG.token) {
	throw new Error("DOTBOOK_TOKEN is not set — copy .env.example to .env")
}
