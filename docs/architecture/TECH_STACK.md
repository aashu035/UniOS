# Technology Stack - UniOS

This file lists the libraries that the app imports at the current commit. `package.json` and `package-lock.json` hold the exact versions. When this file and the manifest disagree, the manifest wins (see [Source of Truth](../SOURCE_OF_TRUTH.md)).

Each row was checked with a search for an import in `app/`, `components/`, `core/` and `domains/`.

## Runtime

| Library | Version (`package.json`) | Use |
| --- | --- | --- |
| Expo SDK | `~56.0.19` | App runtime and native modules |
| React Native | `0.85.3` | UI framework, Hermes engine |
| React | `19.2.3` | UI library |
| Expo Router | `~56.2.18` | File-based routes in `app/` |
| TypeScript | `~6.0.3` (dev) | Type checking (`npm run typecheck`) |

## Data

| Library | Use |
| --- | --- |
| `expo-sqlite` | Local database `unios.db` (`core/db/client.ts`). Its `kv-store` holds small UI preferences (`core/settings/prefs.ts`). |
| `drizzle-orm` | Schema and queries. The driver is synchronous. Migrations are in `drizzle/`. |
| `expo-secure-store` | Stores the Gemini API key (`core/settings/aiProviders.ts`). |

## UI

| Library | Use |
| --- | --- |
| `components/uni/*` with `StyleSheet` | Design system for the redesigned screens |
| `nativewind` with `tailwindcss` | Configured in `babel.config.js` as the JSX import source. No screen uses `className` at this commit, so it is a removal candidate (needs a check and a device test). |
| `react-native-paper` | Only `PaperProvider` and `Button` in `app/_layout.tsx` |
| `lucide-react-native`, `react-native-svg` | Icons and drawings |
| `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler` | Animation and gestures |
| `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/jetbrains-mono` | Fonts, bundled with the app |
| `expo-haptics` | Touch feedback |

## Files and viewers

| Library | Use |
| --- | --- |
| `expo-file-system` (`/legacy` API) | Stored uploads in the app's `resources/` folder |
| `expo-document-picker`, `expo-image-picker` | Pick files and photos, and take photos |
| `expo-sharing`, `expo-intent-launcher`, `expo-linking` | Share files and open them in other apps |
| `react-native-pdf` with `react-native-blob-util` | PDF viewer |
| `expo-video` | Video and audio player |
| `fflate` | Unzips docx, xlsx and pptx files for the office readers (`domains/resource/office.ts`) |
| `react-native-markdown-display`, `markdown-it` | Notes and Markdown files |
| `expo-clipboard` | Copy and paste. It loads through an optional `require` (`core/utils/clipboard.ts`). |

## External services

| Library | Service | When it sends data |
| --- | --- | --- |
| `@google/genai` | Google Gemini | Only during an AI timetable scan or a key check (`core/ai/timetableParser.ts`) |
| `@sentry/react-native` | Sentry | Always on: crashes, errors, performance traces and profiles, console logs, session replay, user reports (`app/_layout.tsx`, `core/diagnostics/index.ts`) |

## Tests

| Library | Use |
| --- | --- |
| `jest`, `ts-jest` | Test runner |
| `better-sqlite3` | Database tests on the real migrations (`testing/expoSqliteHarness.ts`) |
| `fast-check` | Property-based tests |

## Installed but not imported

These packages are in `package.json`, but no import was found. Check before you remove one: a library can need another as a peer, or Metro can need it at bundle time.

| Package | Note |
| --- | --- |
| `react-native-webview` | No import found. |
| `punycode` | No import found. `markdown-it` 10 asks for the `punycode` module. |
| `expo-dev-client` | Used by the development build, not imported in code. |

## Not used

- **TanStack React Query** is not installed and not used. Screens read through domain repositories and the snapshot in `domains/academic/snapshot.ts`.
- **No local AI server.** The laptop companion and its client were removed in commit `8b38196`.

## Commands

The `package.json` scripts are the authority. The main ones:

| Command | What it does |
| --- | --- |
| `npm ci` | Install the exact versions from the lockfile |
| `npm run check` | `tsc --noEmit`, then all Jest tests |
| `npm run dev` | Metro for the development build (`expo start --dev-client`) |
| `npm run build:dev` | EAS cloud build of the development client APK |
| `npm run build:preview` | EAS cloud build of the standalone APK |
| `npm run android` | Local native build (`expo run:android`), needs Android Studio |
| `npm run doctor` | `expo-doctor` |

Expo Go is not supported. Web is not a supported target. See the [README](../../README.md#install-and-run).
