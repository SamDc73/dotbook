import { createContext } from "react"

// A Button provides this so the <Text> inside it takes the variant's on-colour
// without every call site passing a class. Lives apart from Text.jsx so that
// file exports only components (Fast Refresh needs that).
export const TextClassContext = createContext(undefined)
