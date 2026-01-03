import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
    {
        languageOptions: { globals: globals.browser },
        rules: {
            semi: ['error', 'always'],
            'no-multi-str': 'off',
            'new-cap': 'off',
            'consistent-return': 'off',
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
            'no-debugger': 'error',
            'no-unused-vars': 'warn',
            'max-len': [
                'error',
                {
                    code: 80,
                    ignoreComments: true,
                    ignoreRegExpLiterals: true,
                    ignoreTrailingComments: true,
                    ignoreTemplateLiterals: true,
                    ignoreStrings: true,
                    ignoreUrls: true,
                },
            ],
        },
    },
    pluginJs.configs.recommended,
];
