import { sync } from "@dotbook/core/sync"

// One sync with the server, pure: no Expo, no storage, so it runs under bun
// with the server in-process (see the scratch test). `post(body)` is the
// transport and returns the parsed response; anything it throws is a failure.
//
// AGENTS.md: wrap synchronize() in a retry-once block. A failed attempt has
// applied nothing from the round that failed, and everything it did apply in
// earlier rounds is already in the tables — so the second attempt simply
// carries on, and the captured messages from both attempts are reported.

/**
 * @param {import("@dotbook/core/sync").SyncDb} adapter
 * @param {string} groupId
 * @param {(body: object) => Promise<{ messages: object[], merkle: object }>} post
 * @returns {Promise<{ rounds: number, entryIds: string[], datasets: Set<string> }>}
 *   which `entries` rows and which datasets foreign messages touched
 */
export async function runRound(adapter, groupId, post) {
	const received = []
	const capturing = async (request) => {
		const response = await post(request)
		received.push(...response.messages)
		return response
	}

	let rounds
	try {
		rounds = await sync(adapter, groupId, capturing)
	} catch {
		rounds = await sync(adapter, groupId, capturing)
	}
	return { rounds, ...touched(received) }
}

function touched(messages) {
	const entryIds = new Set()
	const datasets = new Set()
	for (const message of messages) {
		datasets.add(message.dataset)
		if (message.dataset === "entries") {
			entryIds.add(message.row)
		}
	}
	return { entryIds: [...entryIds], datasets }
}
