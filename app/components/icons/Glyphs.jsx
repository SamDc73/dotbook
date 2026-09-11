import Svg, { Circle, Path, Rect } from "react-native-svg"

// The places' icons, copied stroke for stroke from the palette page's symbols:
// thin 24-grid line work, round caps, no fills. Each takes the same props a
// lucide icon does (`color`, `size`, plus anything for the Svg), so the `Icon`
// wrapper colours them from a token class — `<Icon as={TodayGlyph}
// className="text-primary" />` — and nothing here names a colour.
function glyph(name, children) {
	function Glyph({ color = "currentColor", size = 24, strokeWidth = 1.6, ...props }) {
		return (
			<Svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				{...props}
			>
				{children}
			</Svg>
		)
	}
	Glyph.displayName = name
	return Glyph
}

export const TodayGlyph = glyph("TodayGlyph", [
	<Rect key="frame" x="3" y="5" width="18" height="16" rx="3" />,
	<Path key="lines" d="M3 10h18M8 3v4M16 3v4" />,
])

export const PlanGlyph = glyph("PlanGlyph", [
	<Circle key="face" cx="12" cy="12" r="9" />,
	<Path key="hands" d="M12 7v5l3 2" />,
])

export const TodoGlyph = glyph("TodoGlyph", <Path d="M4 7h3M4 12h3M4 17h3M10 7h10M10 12h10M10 17h10" />)

export const HabitGlyph = glyph("HabitGlyph", [
	<Circle key="ring" cx="12" cy="12" r="9" />,
	<Path key="tick" d="m8.5 12 2.5 2.5 4.5-5" />,
])

export const MoreGlyph = glyph("MoreGlyph", [
	<Circle key="a" cx="6" cy="12" r="1.4" />,
	<Circle key="b" cx="12" cy="12" r="1.4" />,
	<Circle key="c" cx="18" cy="12" r="1.4" />,
])

export const FocusGlyph = glyph("FocusGlyph", [
	<Circle key="ring" cx="12" cy="12" r="8" />,
	<Path key="ticks" d="M12 2v4M12 18v4M2 12h4M18 12h4" />,
])

export const TemplatesGlyph = glyph("TemplatesGlyph", [
	<Path key="top" d="m12 3 9 5-9 5-9-5z" />,
	<Path key="bottom" d="m3 13 9 5 9-5" />,
])

export const RecurringGlyph = glyph("RecurringGlyph", [
	<Path key="a" d="M17 2l4 4-4 4" />,
	<Path key="b" d="M3 11V9a4 4 0 0 1 4-4h14" />,
	<Path key="c" d="M7 22l-4-4 4-4" />,
	<Path key="d" d="M21 13v2a4 4 0 0 1-4 4H3" />,
])

export const TrendsGlyph = glyph("TrendsGlyph", [
	<Path key="line" d="M3 17l6-6 4 4 8-8" />,
	<Path key="arrow" d="M14 7h7v7" />,
])

export const SettingsGlyph = glyph("SettingsGlyph", [
	<Circle key="hub" cx="12" cy="12" r="3" />,
	<Path
		key="cog"
		d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
	/>,
])
