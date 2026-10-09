// Every environment variable, read once. Nothing else in the server touches
// process.env. Bun loads `.env` on its own; see `.env.example`.

const env = process.env
const SIGNUP = ["first", "open", "closed"]

export const CONFIG = {
	port: Number(env.PORT ?? 3000),
	// accounts.sqlite and users/<id>.sqlite live here.
	dataDir: env.DATA_DIR ?? "./data",
	// Who may create an account: `first` — anyone, until the first user exists;
	// `open` — anyone, always; `closed` — only the CLI (`bun src/cli.js user add`).
	signup: env.SIGNUP ?? "first",
	// The shortest password the server accepts. 8 is a sensible floor for a
	// server on the internet; a box on your own LAN may want less.
	minPassword: Number(env.MIN_PASSWORD_LENGTH ?? 8),
	// Browsers allowed to call the API — the web app's origin(s). No wildcard.
	corsOrigins: (env.CORS_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
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

if (!Number.isInteger(CONFIG.minPassword) || CONFIG.minPassword < 1) {
	throw new Error(`MIN_PASSWORD_LENGTH is a whole number of 1 or more, not "${env.MIN_PASSWORD_LENGTH}"`)
}
if (!SIGNUP.includes(CONFIG.signup)) {
	throw new Error(`SIGNUP is one of ${SIGNUP.join(", ")}, not "${CONFIG.signup}"`)
}
