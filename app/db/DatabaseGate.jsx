// Native: one app, one database, nothing to wait for. The web version
// (DatabaseGate.web.jsx) takes a lock because OPFS allows one connection per origin.
export function DatabaseGate({ children }) {
	return children
}
