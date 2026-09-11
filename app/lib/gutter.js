// The classes that give a log row its own segment of the gutter: the hour's
// tint for a timed line, the hairline colour for everything else (untimed
// lines, todos, the composer). Rows draw the drift themselves, so it stops
// where the rows stop. The 24 `border-hour-XX` utilities are safelisted in
// global.css.

/** @param {string|null} hour  zero-padded local hour, or null */
export function gutter(hour) {
	return hour === null || hour === undefined
		? "border-l-2 border-outline-variant pl-md"
		: `border-l-2 border-hour-${hour} pl-md`
}
