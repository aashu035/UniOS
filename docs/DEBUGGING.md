# Running, debugging and reporting bugs

## 1. One-time: install the dev build ("UniOS Dev")

Expo Go only runs the newest Expo SDK, so it breaks every time the Play Store updates it. The dev build is your own Expo Go, pinned to this project. It installs **next to** the real UniOS app, has its own data, and never conflicts with it.

```powershell
npm install -g eas-cli        # if not installed
eas login
npm run build:dev             # = eas build -p android --profile development
```

When the build finishes, open the link on the phone (or scan the QR code) and install the APK.

Rebuild it only when native code changes: an Expo SDK upgrade, a new native library, or a change to `app.json`/`app.config.js` plugins. JS and UI changes never need a rebuild.

## 2. Daily: run code on the phone

```powershell
npm run dev                         # Metro for the dev build
adb reverse tcp:8081 tcp:8081       # USB: phone reaches Metro over the cable
```

Then either press `a` in the Metro window, or open **UniOS Dev** on the phone and pick the server. Changes reload on save.

- In the app, shake the phone or run `adb shell input keyevent 82` to open the dev menu: reload, performance monitor, element inspector, and React Native DevTools (press `j` in Metro).
- To read logs over USB: `npm run logs:android`.

## 3. The APK you use daily

```powershell
npm run build:preview               # = eas build -p android --profile preview
```

Install it over the existing UniOS. It is signed with the same EAS key, so Android updates it in place and keeps your data.

**Never install a locally built APK** (`npx expo run:android`) over it. The signing key differs, Android refuses the update, and uninstalling erases the data. Back up first from **More → Backup & export**.

## 4. Bug reports and crash tracking (Sentry)

- **Crashes and errors** are sent to Sentry automatically, tagged with `environment` = `development` / `preview` / `production`. Filter by it, so dev noise stays out of the real app's issues.
- **More → Report a problem** lets you describe a bug and send it with app version, phone model, data counts (never content) and the last ~60 errors/warnings. It arrives in Sentry under **User Feedback**, with `diagnostics.md` attached and a session replay when available.
- **Share details to another app** on the same screen produces the same text offline. Paste it into Claude or ChatGPT, or send it on WhatsApp.
- If the app crashes to the "Something went wrong" screen, tap **Send crash report**.

## 5. AI tools (MCP)

Two MCP servers are configured for this repo:

| Server | URL | What it gives the AI |
| --- | --- | --- |
| Expo | `https://mcp.expo.dev/mcp` | Expo docs, `expo install`, EAS builds/logs, Play Store crashes. With `npm run dev:mcp` it can also take screenshots, tap, collect app logs and open DevTools on the connected phone. |
| Sentry | `https://mcp.sentry.dev/mcp` | Search issues, read stack traces, user feedback and diagnostics. |

Both use OAuth: you sign in in the browser the first time. No keys are stored in the repo.

### Claude Code

`.mcp.json` is committed, so Claude Code offers both servers when opened in this folder. Run `/mcp` to sign in.

### Cursor

`.cursor/mcp.json` is committed. Enable the servers in **Settings → MCP**.

### VS Code (Copilot agent mode)

`.vscode/mcp.json` is committed. Start them from the MCP view.

### Codex CLI

```powershell
codex mcp add expo --url https://mcp.expo.dev/mcp
codex mcp add sentry --url https://mcp.sentry.dev/mcp
codex mcp login expo
```

### ChatGPT

Settings → Apps & Connectors → Advanced → turn on **Developer mode**, then create a connector with the URL above. Availability depends on your plan.

### Claude (web/desktop/mobile)

Add **Expo** and **Sentry** from Settings → Connectors.

### Local Expo tools (screenshots, taps, logs)

```powershell
npm run dev:mcp           # Metro + EXPO_UNSTABLE_MCP_SERVER=1 (works in PowerShell)
npx expo whoami           # must be the same Expo account the MCP server is signed in with
```

Reconnect the `expo` MCP server in your AI tool after starting or stopping Metro.

Project rules for every AI tool are in `AGENTS.md`. `CLAUDE.md` points to it.
