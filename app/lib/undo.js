import { useSyncExternalStore } from "react"

// One undo at a time: whatever was just removed or closed can be put back from
// the bar at the bottom of the screen (components/UndoBar.jsx) for a few
// seconds. A newer offer replaces the one showing.
//
//   offerUndo("Line deleted", () => restoreEntry(db, id))

const SHOW_MS = 6000

let offer = null
let timer = null
const listeners = new Set()

function publish(next) {
	clearTimeout(timer)
	offer = next
	for (const listener of listeners) listener()
}

export function offerUndo(label, undo) {
	publish({ label, undo })
	timer = setTimeout(() => publish(null), SHOW_MS)
}

// Runs the offer showing, once; the bar goes away either way.
export function takeUndo() {
	const taken = offer
	publish(null)
	return taken ? taken.undo() : undefined
}

function subscribe(listener) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

function current() {
	return offer
}

export function useUndoOffer() {
	return useSyncExternalStore(subscribe, current, current)
}
