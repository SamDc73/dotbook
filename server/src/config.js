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
	// One person, one group. Every device sends this groupId; any other is refused.
	groupId: env.GROUP_ID ?? "default",
	// The model that classifies habits. Unset AI_PROVIDER = classification off.
	// Swapping Ollama for Anthropic is these variables and nothing in code.
	ai: {
		provider: env.AI_PROVIDER ?? null,
		model: env.AI_MODEL ?? null,
		ollamaUrl: env.OLLAMA_URL ?? "http://localhost:11434",
		anthropicApiKey: env.ANTHROPIC_API_KEY ?? null,
		openaiApiKey: env.OPENAI_API_KEY ?? null,
	},
	classifyEveryMin: Number(env.CLASSIFY_EVERY_MIN ?? 10),
}

if (!CONFIG.token) {
	throw new Error("DOTBOOK_TOKEN is not set — copy .env.example to .env")
}
