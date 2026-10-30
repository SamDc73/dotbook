// Web twin of context.native.js — the browser holds no database, so the hook
// resolves to null. Screens pass it on to db/*.web.js twins, which ignore it.
export function useDb() {
	return null
}
