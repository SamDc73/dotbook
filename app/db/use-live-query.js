import { addDatabaseChangeListener } from "expo-sqlite"
import { useEffect, useState } from "react"

// Runs `query(db)` and runs it again whenever any table changes.
// Wrap `query` in useCallback so it only changes when its inputs do.
export function useLiveQuery(db, query) {
	const [rows, setRows] = useState([])

	useEffect(() => {
		let alive = true
		const run = () =>
			query(db).then((result) => {
				if (alive) setRows(result)
			})

		run()
		const subscription = addDatabaseChangeListener(run)
		return () => {
			alive = false
			subscription.remove()
		}
	}, [db, query])

	return rows
}
