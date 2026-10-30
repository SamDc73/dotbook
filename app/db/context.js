// Base of the useDb shim: needed so `@/db/context` resolves at bundling time
// (alias resolution wants a file at the exact path; platform twins take over
// from here — context.web.js on web, context.native.js on native).
export { useDb } from "./context.native"
