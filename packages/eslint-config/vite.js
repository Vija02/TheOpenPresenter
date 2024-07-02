const { resolve } = require("node:path")

const project = resolve(process.cwd(), "tsconfig.json")

/** @type {import("eslint").Linter.Config} */
module.exports = {
	extends: [
		"eslint:recommended",
		"prettier",
		"plugin:@typescript-eslint/recommended",
		"plugin:react-hooks/recommended",
		"turbo",
	],
	globals: {
		React: true,
		JSX: true,
	},
	env: {
		node: true,
		browser: true,
		es2020: true,
	},
	plugins: ["only-warn", "react-refresh"],
	settings: {
		"import/resolver": {
			typescript: {
				project,
			},
		},
	},
	ignorePatterns: [
		// Ignore dotfiles
		".*.js",
		"node_modules/",
		"dist",
		".eslintrc.cjs",
	],
	rules: {
		"react-refresh/only-export-components": [
			"warn",
			{ allowConstantExport: true },
		],
	},
}
