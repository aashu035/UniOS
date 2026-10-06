#!/usr/bin/env node
// Start Metro for the dev build with Expo MCP local capabilities turned on
// (screenshots, taps, app logs, DevTools for Claude Code / Cursor / Codex).
// Works the same in PowerShell, cmd and bash, which `VAR=1 cmd` does not.
//
//   npm run dev:mcp            (then reconnect the "expo" MCP server in your AI tool)
import { spawn } from 'node:child_process';

const child = spawn('npx', ['expo', 'start', '--dev-client', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_UNSTABLE_MCP_SERVER: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
