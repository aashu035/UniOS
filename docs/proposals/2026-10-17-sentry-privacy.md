# Proposal: Sentry privacy settings

| Field | Value |
| --- | --- |
| Status | **Proposal. Awaiting owner approval. No code is changed.** |
| Date | 2026-10-17 |
| Code reviewed | `app/_layout.tsx:25-45` and `core/diagnostics/index.ts` at commit `b779d2d` |
| SDK reviewed | `@sentry/react-native` 7.11.0, from the installed source in `node_modules` |
| Owner's stated preference | Turn off Session Replay until its privacy impact and masking receive a full review. Decide crash reporting and performance monitoring separately. |

## 1. Current configuration

```ts
// app/_layout.tsx:25-45 (abridged; option values exact)
Sentry.init({
  dsn: '…',                      // public ingest key, in the bundle
  sendDefaultPii: false,
  environment: appVariant(),     // development | preview | production
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  profilesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.expoRouterIntegration(…)],
  enableNativeFramesTracking: !isRunningInExpoGo(),
  enableLogs: true,
});
```

`Sentry.init` runs when `app/_layout.tsx` is imported. That happens in every build variant. No setting in the app turns it off.

## 2. What each part collects and sends

Each row comes from the installed SDK source. The "Source" column names the file under `node_modules/@sentry/`.

| Part | Turned on by | What it sends | Source |
| --- | --- | --- | --- |
| **A. Crash and error reporting** | Always (default integrations) | JS errors and native crashes, with stack traces (`attachStacktrace: true`). Also device context (`deviceContextIntegration`), Expo context and the release. | `react-native/dist/js/integrations/default.js:17-43`, `react-native/dist/js/sdk.js:27-43` |
| A1. Breadcrumbs | Always | The last events before an error: console messages, and XHR requests (method, URL, status code). Not headers or bodies. `fetch` breadcrumbs are off on native. | `react-native/dist/js/integrations/breadcrumbs.js:9`, `browser/build/npm/esm/dev/integrations/breadcrumbs.js:189-195` |
| **B. Performance monitoring** | `tracesSampleRate` (0.2 in production) | Timings of app start, screen loads (Expo Router), slow and frozen frames, stalls. | `default.js:61-81` |
| B1. Profiling | `profilesSampleRate: 1.0` | Hermes CPU profiles (function call stacks over time) for every sampled trace. | `default.js:55-56` (`hermesProfilingIntegration`) |
| **C. Session Replay** | `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0` | A screen recording of 10% of sessions, and of the moments before an error in every session that has one. | `react-native/dist/js/replay/mobilereplay.js` |
| C1. Replay masking | SDK defaults | `maskAllText`, `maskAllImages` and `maskAllVectors` are all `true`. | `mobilereplay.js:18-20` |
| **D. Logs** | `enableLogs: true` | Every `console` call at every level (`debug`, `info`, `warn`, `error`, `log`, `assert`, `trace`), sent as Sentry Logs. | `default.js:45-47` (`consoleLoggingIntegration`), `core/build/esm/utils/debug-logger.js:5` (`CONSOLE_LEVELS`) |
| **E. Report a problem** | The student taps Send | The note, an optional email, a `diagnostics.md` file (app and device details, table row counts, recent console warnings and errors) and the current replay (`includeReplay: true`). | `core/diagnostics/index.ts:64-68` |

What the app logs (34 `console` calls in `app/`, `components/`, `core/`, `domains/`):

- One `console.info`: the Gemini model name (`core/ai/timetableParser.ts:78`).
- `console.error` and `console.warn` with an error message or an error object, for example `'Could not save task', e` (`components/task/TaskForm.tsx:141`).

The Gemini API key does not appear in XHR breadcrumbs. The SDK sends it in the `x-goog-api-key` header (`@google/genai/dist/web/index.mjs:25822`), and breadcrumbs record only method, URL and status.

### Open leads (not verified)

| ID | Question | Why it is open | How to check |
| --- | --- | --- | --- |
| S-L1 | Can a database error message contain record text (a task title, a note) and reach Sentry Logs or the report? | Drizzle's `DrizzleQueryError` adds query values to its message (`drizzle-orm/errors.js:12-13`). The expo driver's synchronous `run`, `all` and `get` call `executeSync` directly and do not use that wrapper (`drizzle-orm/expo-sqlite/session.js:70-95`). Whether expo-sqlite's own native error text holds values is not known. | Force a constraint error on a dev build. Read the event in Sentry. |
| S-L2 | Does masking hide every sensitive view in UniOS, such as the PDF viewer, the video player and the markdown notes? | Sentry's docs say to verify masking before production use. Native views (`react-native-pdf`, `expo-video`) are not checked. | Record a replay on a dev build. Inspect each screen in Sentry. |
| S-L3 | Does Sentry store the IP address of the phone? | `sendDefaultPii: false` is set. Server-side IP handling depends on the Sentry project settings, which I cannot see. | Check the Sentry project's "Prevent storing of IP addresses" setting. |

## 3. Options

Each decision is separate.

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| 1 | Session Replay | a) Keep. b) **Turn off.** c) Turn on only for `development`. | **b**, as the owner prefers. Remove `mobileReplayIntegration()` and both replay rates. Set `includeReplay: false` in `sendReport`. |
| 2 | Logs | a) Keep all levels. b) Only `warn` and `error`. c) Off. | **b or c.** All levels are on now. Option b: `enableLogs: true` with `consoleLoggingIntegration({ levels: ['warn', 'error'] })`. Option c: `enableLogs: false`. |
| 3 | Performance monitoring | a) Keep at 20%. b) Lower (for example 5%) in `production`. c) Off. | Owner decision. Traces hold timings and screen names, not record contents. |
| 4 | Profiling | a) Keep 100% of sampled traces. b) Lower or off. | Owner decision. Profiles hold function names and timings. The earlier launch review (`docs/AUDIT_AND_LAUNCH_2026-10.md`, risk 3) flagged the 1.0 rate as a quota cost. |
| 5 | Crash reporting | a) Keep on. b) Off by default, with an opt-in. c) On by default, with an opt-out setting. | Owner decision. Option c needs a new setting stored in `core/settings/prefs.ts`, and the setting must be read before `Sentry.init`. |
| 6 | Disclosure | The README already lists the services. A Play Store release also needs a privacy policy and the Data safety form. | Write the privacy policy after decisions 1 to 5. |

## 4. Plan after approval (separate branch, not `chore/promotion-readiness`)

1. Create a branch from `master`, for example `fix/sentry-privacy`.
2. Change `app/_layout.tsx` and `core/diagnostics/index.ts` to match the approved options.
3. Move the options into one exported object, so a unit test can assert them. Add `__tests__/sentry_config.test.ts`. It must check that the replay sample rates are absent or `0` and that `includeReplay` is `false`. It must also check the log levels.
4. Update the README privacy table, `docs/architecture/ARCHITECTURE.md` and this proposal's status.
5. Run `npm run check`.
6. Build the dev client. Confirm in Sentry that no replay arrives, then confirm which logs arrive.

## 5. References

- Sentry, Session Replay privacy for React Native: <https://docs.sentry.io/platforms/react-native/session-replay/privacy/>
- Installed SDK source: `node_modules/@sentry/react-native` 7.11.0
