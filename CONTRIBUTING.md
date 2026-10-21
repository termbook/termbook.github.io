# Contributing

Thank you for helping improve Termbook.

## Ways to help
- Report a bug or suggest an idea through the issue templates.
- Improve the guides in `docs/`.
- Send a pull request. Keep it focused on one change.

## Before you open a pull request
1. Fork the repository and create a branch.
2. Install dependencies with `npm ci`, then run `npm test`, `npm run lint` and `npm run build`.
3. If you change `firestore.rules`, add or update a test in `tests/rules.test.js` and run `npm run test:rules` (needs Java).
4. Never include real student or teacher data in issues, screenshots or tests.

## Code style
Plain JavaScript modules, no framework. Keep user-facing text short and clear, with dates as DD/MM/YYYY and names surname first.
