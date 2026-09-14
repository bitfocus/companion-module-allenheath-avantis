import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default [
	...(await generateEslintConfig({
		enableTypescript: true,
	})),
	{
		// Developer aid: runs the built module against the published protocol
		// tables, so it imports from dist and exits with a status code.
		files: ['support/**/*.mjs'],
		rules: {
			'n/no-unpublished-import': 'off',
			'n/no-process-exit': 'off',
		},
	},
]
