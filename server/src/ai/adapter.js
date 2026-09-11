// The one place a model is chosen. Provider, model and credentials come from
// the environment through config.js; TanStack AI makes the call the same way
// for every provider, so Ollama → Anthropic → OpenAI is env-only.

import { chat } from "@tanstack/ai"
import { createAnthropicChat } from "@tanstack/ai-anthropic"
import { createOllamaChat } from "@tanstack/ai-ollama"
import { createOpenaiChat } from "@tanstack/ai-openai"

/**
 * @typedef {object} Classifier
 * @property {(system: string, user: string) => Promise<string>} complete  one model call, the answer as text
 * @property {string} model  recorded on every tick and run it produces
 */

/**
 * The classifier for the configured provider, or null when none is configured
 * (classification stays off; sync and ingest do not care).
 * @param {import("../config.js").CONFIG["ai"]} ai
 * @returns {Classifier | null}
 */
export function classifierFor(ai) {
	if (!ai.provider || !ai.model) {
		return null
	}
	const adapter = adapterFor(ai)
	return {
		model: ai.model,
		// stream: false → the collected text, which is all a JSON verdict needs.
		complete: (system, user) =>
			chat({ adapter, systemPrompts: [system], messages: [{ role: "user", content: user }], stream: false }),
	}
}

function adapterFor({ provider, model, ollamaUrl, anthropicApiKey, openaiApiKey }) {
	switch (provider) {
		case "ollama":
			return createOllamaChat(model, ollamaUrl)
		case "anthropic":
			return createAnthropicChat(model, anthropicApiKey)
		case "openai":
			return createOpenaiChat(model, openaiApiKey)
		default:
			throw new Error(`AI_PROVIDER must be ollama, anthropic or openai — got "${provider}"`)
	}
}
