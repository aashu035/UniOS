/**
 * expo-clipboard, loaded only when the installed build has its native module.
 * A dev build made before it was added would throw at import, so screens check
 * `Clipboard.available()` and hide Paste/Copy instead of crashing.
 */
type Mod = { getStringAsync(): Promise<string>; setStringAsync(s: string): Promise<boolean> };
let mod: Mod | null | undefined;
function load(): Mod | null {
  if (mod === undefined) {
    try { mod = require('expo-clipboard') as Mod; } catch { mod = null; }
  }
  return mod;
}

export const Clipboard = {
  available: () => !!load(),
  async getString(): Promise<string> {
    try { return (await load()?.getStringAsync()) ?? ''; } catch { return ''; }
  },
  async setString(s: string): Promise<boolean> {
    try { return !!(await load()?.setStringAsync(s)); } catch { return false; }
  },
};
