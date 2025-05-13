module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'ticket-number-rule': ({ subject }) => {
          const pattern = /^AIO-\d+\s+.+$/;
          return [
            pattern.test(subject),
            'Commit subject must contain FOL- followed by a number and description (e.g., "feat: FOL-12 add login system")',
          ];
        },
      },
    },
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', //→ New features (e.g., "feat: FOL-12 add login system")
        'fix', //→ Bug fixes (e.g., "fix: FOL-34 resolve memory leak")
        'docs', //→ Documentation changes (e.g., "docs: FOL-56 update API guide")
        'style', //→ Code style changes (e.g., "style: FOL-78 format user service")
        'refactor', //→ Code restructuring (e.g., "refactor: FOL-90 simplify auth logic")
        'test', //→ Test-related changes (e.g., "test: FOL-123 add unit tests for auth")
        'chore', //→ Maintenance tasks (e.g., "chore: FOL-456 update dependencies")
        'perf', //→ Performance improvements (e.g., "perf: FOL-789 optimize queries")
        'ci', //→ CI/CD changes (e.g., "ci: FOL-321 add GitHub workflow")
        'build', //→ Build system changes (e.g., "build: FOL-654 update webpack config")
        'revert', //→ Reverting changes (e.g., "revert: FOL-987 remove feature")
      ],
    ],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 200],
    'ticket-number-rule': [2, 'always'],
  },
};
