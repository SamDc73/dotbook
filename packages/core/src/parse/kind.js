// Plan vs log needs no toggle: a line whose time has not happened yet is a plan.
// A timed line is a plan when it starts in the future, an untimed one when its
// day is after today. Lines are written on the phone and by the server's MCP
// endpoint, so the rule lives here and both read it. One rule, easy to flip if
// it proves wrong.

import { localDay } from "./natural.js"

/**
 * @param {{ tsStart: number|null, day: string }} parsed  what `parseLineTime` returned for the line
 * @param {number} now  epoch ms
 * @returns {"plan"|"log"}
 */
export function lineKind(parsed, now) {
	if (parsed.tsStart !== null) {
		return parsed.tsStart > now ? "plan" : "log"
	}
	return parsed.day > localDay(now) ? "plan" : "log"
}
