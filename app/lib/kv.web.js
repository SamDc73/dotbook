// The kv-store's web twin: the same surface on localStorage. expo-sqlite's
// kv-store is native-only, and nothing else in the app may reach localStorage
// directly — this file is the one place that does.
//
// Only the async members are used in app/ (getItemAsync, setItemAsync with an
// update function, removeItemAsync); the rest mirrors the Storage class so any
// member a screen picks up later behaves the same.

const read = (key) => localStorage.getItem(key)

// A plain string, or the update-function form: the new value computed from the
// previous one (null when unset), exactly as Storage.setItemAsync accepts.
const resolve = (key, value) => (typeof value === "function" ? value(read(key)) : value)

function remove(key) {
	const had = read(key) !== null
	localStorage.removeItem(key)
	return had
}

const allKeys = () => Object.keys(localStorage)

// A shallow JSON merge, standing in for Storage's deep one — nothing in app/
// merges today, so the shape is what matters, not the depth.
function merged(previous, value) {
	const base = previous === null ? {} : JSON.parse(previous)
	return JSON.stringify({ ...base, ...JSON.parse(value) })
}

export const Storage = {
	async getItemAsync(key) {
		return read(key)
	},
	async setItemAsync(key, value) {
		localStorage.setItem(key, resolve(key, value))
	},
	async removeItemAsync(key) {
		return remove(key)
	},
	async getAllKeysAsync() {
		return allKeys()
	},
	async clearAsync() {
		localStorage.clear()
		return true
	},
	async getLengthAsync() {
		return localStorage.length
	},
	async getKeyByIndexAsync(index) {
		return allKeys()[index] ?? null
	},
	async closeAsync() {
		// nothing to close: localStorage is always open
	},
	getItemSync(key) {
		return read(key)
	},
	setItemSync(key, value) {
		localStorage.setItem(key, resolve(key, value))
	},
	removeItemSync(key) {
		return remove(key)
	},
	getAllKeysSync() {
		return allKeys()
	},
	clearSync() {
		localStorage.clear()
		return true
	},
	closeSync() {
		// nothing to close: localStorage is always open
	},
	// The AsyncStorage-compatible aliases.
	getItem(key) {
		return this.getItemAsync(key)
	},
	setItem(key, value) {
		return this.setItemAsync(key, value)
	},
	removeItem(key) {
		return this.removeItemAsync(key).then(() => {
			// the alias drops the boolean the async form returns
		})
	},
	getAllKeys() {
		return this.getAllKeysAsync()
	},
	clear() {
		return this.clearAsync().then(() => {
			// the alias drops the boolean the async form returns
		})
	},
	close() {
		return this.closeAsync()
	},
	async mergeItem(key, value) {
		localStorage.setItem(key, merged(read(key), value))
	},
	async multiGet(keys) {
		return keys.map((key) => [key, read(key)])
	},
	async multiSet(pairs) {
		for (const [key, value] of pairs) localStorage.setItem(key, value)
	},
	async multiRemove(keys) {
		for (const key of keys) localStorage.removeItem(key)
	},
	async multiMerge(pairs) {
		for (const [key, value] of pairs) localStorage.setItem(key, merged(read(key), value))
	},
}

export const AsyncStorage = Storage
export default Storage
