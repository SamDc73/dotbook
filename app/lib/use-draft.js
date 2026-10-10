import Storage from "expo-sqlite/kv-store"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

// A text field whose unsent text is kept on the device under `key`: closed,
// killed or reloaded mid-line, it opens with the line still in it. Saved once
// typing pauses, and at once when the app leaves the front; empty removes it.
//
//   const [text, setText] = useDraft("composer-draft")

const SAVE_DELAY_MS = 500

export function useDraft(key) {
	const [text, setText] = useState("")
	// Set by the first keystroke, so a restore that lands late never overwrites typing.
	const typed = useRef(false)
	// The text not saved yet, or null when the store has it.
	const unsaved = useRef(null)
	const timer = useRef(null)

	useEffect(() => {
		Storage.getItemAsync(key).then((saved) => {
			if (saved !== null && !typed.current) setText(saved)
		})
	}, [key])

	const save = useCallback(() => {
		clearTimeout(timer.current)
		const next = unsaved.current
		if (next === null) return
		unsaved.current = null
		if (next === "") Storage.removeItemAsync(key)
		else Storage.setItemAsync(key, next)
	}, [key])

	useEffect(() => {
		const leaving = AppState.addEventListener("change", (state) => {
			if (state !== "active") save()
		})
		return () => {
			leaving.remove()
			save()
		}
	}, [save])

	const update = useCallback(
		(next) => {
			typed.current = true
			unsaved.current = next
			setText(next)
			// Emptied — usually by Enter — is cleared at once, so a line already
			// logged never comes back as a draft.
			if (next === "") {
				save()
				return
			}
			clearTimeout(timer.current)
			timer.current = setTimeout(save, SAVE_DELAY_MS)
		},
		[save]
	)

	return [text, update]
}
