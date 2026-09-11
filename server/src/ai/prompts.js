// All prompts live here, centralized regardless of file size (see AGENTS.md).

// Bump this when the wording below changes. Ticks and runs are keyed by it, so a
// new version means every finished day is classified again on the next pass.
export const PROMPT_VERSION = "1"

// The whole reason a model sits here instead of a regex is the first rule:
// context, not keywords. The phrases are V0.1's own.
export const CLASSIFY_SYSTEM = `You read one day of a person's own log lines and judge, for each habit they track, whether that day's log shows the habit was kept or broken.

Rules:
- Judge only what the lines say actually happened. Context matters, not keywords. For an "avoid" habit, "having urges to watch porn" must NOT count as a violation — nothing was done. "watched porn" must count as a violation.
- For a "do" habit, "kept" means the lines show it was done; "broken" means the lines say it was skipped or not done.
- Absence of any mention is "unknown", never a tick. Silence is not evidence.
- Answer with JSON only, nothing before or after it, in exactly this shape:
{"verdicts":[{"habit":"<habit name exactly as given>","verdict":"kept" | "broken" | "unknown","reasoning":"<one sentence>"}]}
Include every habit exactly once.`

/**
 * The user turn: the habits and the day's log lines, in typing order.
 * @param {{ name: string, kind: "do"|"avoid" }[]} habits
 * @param {string[]} lines
 */
export function classifyPrompt(habits, lines) {
	const habitList = habits.map((habit) => `- ${habit.name} (${habit.kind})`).join("\n")
	const logList = lines.map((line) => `- ${line}`).join("\n")
	return `Habits:\n${habitList}\n\nThe day's log, in the order it was written:\n${logList}`
}
