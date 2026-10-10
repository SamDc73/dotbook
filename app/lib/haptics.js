import { AndroidHaptics, performAndroidHapticsAsync } from "expo-haptics"

// A small tap under the finger when something is written: a line logged, a todo
// done, a habit ticked, an undo. These are Android's own feedback constants, so
// the phone's touch-feedback setting decides whether they are felt at all; on
// the web they do nothing. A phone too old for a constant refuses it — ignored,
// it is only a tap.
//
//   tap("logged")

const FEEL = {
	logged: AndroidHaptics.Confirm, // a line or a timer written
	done: AndroidHaptics.Toggle_On, // a todo closed as done
	kept: AndroidHaptics.Confirm, // a habit ticked kept
	broken: AndroidHaptics.Toggle_Off, // a habit ticked broken
	undone: AndroidHaptics.Toggle_Off, // an undo, or a tick cleared
}

export function tap(what) {
	performAndroidHapticsAsync(FEEL[what]).catch(() => undefined)
}
