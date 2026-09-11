import { useQuery } from "@tanstack/react-query"

// A query over the local database that stays current: TanStack Query caches the
// rows under `key` and LiveQueries (app/_layout.jsx) invalidates every key when
// the database changes. `key` must name everything `queryFn` reads — the day,
// the order, the id — exactly like a useEffect dependency list.
//
//   const entries = useLiveQuery(["entries", day, order], () => entriesForDay(db, day, order))

// Hoisted so a query that has not answered yet hands every caller the same
// empty array, and nothing downstream re-runs on a fresh `[]` each render.
const NONE = []

export function useLiveQuery(key, queryFn, options) {
	const { data } = useQuery({ queryKey: key, queryFn, ...options })
	return data ?? NONE
}
