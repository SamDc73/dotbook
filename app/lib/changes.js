// The web twins' tap on the shoulder. A native write lands in SQLite and the
// live queries see it at once; a web twin's write lands on the server, so
// after every mutating response it calls `noteChange()` and whoever wires the
// web app refreshes what the screens show.

let fn = () => {
	// replaced by setOnChange; before that, a change is nothing to do
}

export const setOnChange = (f) => {
	fn = f
}

export const noteChange = () => fn()
