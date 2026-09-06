// ESLint — only what Biome doesn't cover. Biome does formatting, JSX/React
// correctness, hooks, exhaustive-deps, naming conventions, a11y, unused code.
// Kept here: import graph checks Biome has no equivalent for.

import importPlugin from "eslint-plugin-import"

export default [
	{
		ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.expo/**", "copied_repos/**"],
	},
	{
		files: ["packages/**/*.js", "app/**/*.{js,jsx}", "server/**/*.js", "extension/**/*.{js,jsx}"],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			import: importPlugin,
		},
		rules: {
			// Circular imports silently break module init order; Biome has no rule for this
			"import/no-cycle": ["warn", { maxDepth: 2 }],
			"import/no-duplicates": "error",
		},
	},
]
