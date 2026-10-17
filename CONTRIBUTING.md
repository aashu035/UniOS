# Contributing to UniOS

Thank you for helping. This file explains how to set up the project, test a change and send it.

## Before you start

- Read [`AGENTS.md`](AGENTS.md). Its "Rules that bite" section lists the rules that tests and reviews enforce: attendance maths, transactions, dates, file paths and migrations.
- For a large change, open an issue first. Describe the problem before the solution.
- Do not open a public issue for a security problem. Read [`SECURITY.md`](SECURITY.md).

## Set up

1. Install Node.js 20.19.4+, 22.13.0+ or 24.3.0+. CI uses Node 22.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Run the checks once, to confirm that your setup works:
   ```bash
   npm run check
   ```

To run the app, you need a development build on an Android phone or emulator. Expo Go does not work. The steps are in the [README](README.md#install-and-run).

## Make a change

1. Create a branch from `master`.
2. Keep each pull request to one topic.
3. When the bug is in logic or data, write a failing test in `__tests__/` first. Then fix the bug.
4. Database tests use `createDeviceDb()` from `testing/expoSqliteHarness.ts`. Do not stub `db.transaction`.
5. A schema change needs a new migration in `drizzle/`. Never rename or renumber an existing migration. `__tests__/migration_chain.test.ts` must pass.
6. A new native module needs a new development build. Load it with an optional `require` in a `try`/`catch`, as `core/utils/clipboard.ts` does.
7. Update the docs in the same pull request when behaviour changes. [`docs/SOURCE_OF_TRUTH.md`](docs/SOURCE_OF_TRUTH.md) says which document owns which fact.

## Test

| Command | What it checks |
| --- | --- |
| `npm run check` | TypeScript, then every Jest test. Run it before each commit. |
| `npm test -- <pattern>` | Only the matching test files |

GitHub Actions runs `npm run check` on each push and pull request. A pull request must pass it.

Automated tests do not cover screens on a device. If your change affects a screen, test it on a development build. Say in the pull request which device and Android version you used.

## Pull requests

Include:

- What changed and why.
- How you tested it: commands, and device checks if any.
- Screenshots for a visible change. They must be real captures from the app.
- Any change to data that leaves the phone. The README privacy table must stay true.

## Report a bug

Open an issue with:

- What you did, what you expected and what happened.
- App version (`app.json`, or the report below, which includes it), Android version and phone model.
- If you can, the report from **More → Report a problem**. Remove any personal data first.

Do not post portal passwords, Gemini API keys or backup files with real data.

## Code of conduct

Everyone who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
