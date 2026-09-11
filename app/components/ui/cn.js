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
	"eyebrow",
	"chip",
	"time",
	"line",
]
const RADIUS = ["xs", "sm", "md", "lg", "xl", "chip", "seg", "panel"]
const FONT = ["display", "display-medium", "body", "body-medium", "body-semibold", "mono", "mono-regular"]
const TRACKING = ["eyebrow", "chip"]
const SHADOW = ["panel"]

const twMerge = extendTailwindMerge({
	extend: {
		theme: { spacing: SPACING, text: TEXT, radius: RADIUS, font: FONT, tracking: TRACKING, shadow: SHADOW },
	},
})

export function cn(...inputs) {
	return twMerge(clsx(inputs))
}
