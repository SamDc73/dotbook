import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Joins class names and lets the last conflicting utility win, so a caller's
// className can override a component's default.
//
// tailwind-merge only knows Tailwind's stock scale names. Ours come from
// tokens.css, so it is told the *names* here (never the values) — otherwise
// `text-body` and `text-on-surface` look like the same utility and one is dropped.
const SPACING = ["3xs", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]
const TEXT = [
	"caption",
	"label",
	"body",
	"callout",
	"subheading",
	"heading",
	"title3",
	"title2",
	"title1",
	"display2",
	"display1",
]
const RADIUS = ["xs", "sm", "md", "lg", "xl"]

const twMerge = extendTailwindMerge({
	extend: { theme: { spacing: SPACING, text: TEXT, radius: RADIUS } },
})

export function cn(...inputs) {
	return twMerge(clsx(inputs))
}
