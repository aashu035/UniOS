/**
 * Pure helpers for bug reports: a small in-memory log of recent problems and
 * a plain-text report you can send to Sentry or paste into an AI assistant.
 * No native imports, so it is unit-tested directly.
 */

export type LogLevel = 'error' | 'warn' | 'info';
export interface LogEntry { at: string; level: LogLevel; message: string }

export class LogBuffer {
  private items: LogEntry[] = [];
  constructor(private readonly size = 60) {}

  add(level: LogLevel, parts: unknown[], now: Date = new Date()) {
    const message = parts.map(stringify).join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!message) return;
    const last = this.items[this.items.length - 1];
    if (last && last.level === level && last.message === message) return; // render loops repeat the same line
    this.items.push({ at: now.toISOString(), level, message });
    if (this.items.length > this.size) this.items.splice(0, this.items.length - this.size);
  }

  list(): LogEntry[] { return [...this.items]; }
  clear() { this.items = []; }
}

export function stringify(x: unknown): string {
  if (x instanceof Error) return `${x.name}: ${x.message}${x.stack ? `\n${x.stack.split('\n').slice(1, 4).join('\n')}` : ''}`;
  if (typeof x === 'string') return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

export interface AppInfo {
  app: string; version: string; build: string | null; variant: string; sdk: string | null;
  os: string; osVersion: string; device: string | null; jsEngine: string;
}

export function formatReport(o: {
  info: AppInfo; data: Record<string, number | string | null>; logs: LogEntry[]; note?: string; screen?: string | null; now?: Date;
}): string {
  const { info, data, logs } = o;
  const lines = [
    '## UniOS diagnostics',
    `Generated: ${(o.now ?? new Date()).toISOString()}`,
    o.screen ? `Screen: ${o.screen}` : null,
    '',
    '### What happened',
    o.note?.trim() || '(no description)',
    '',
    '### App',
    `${info.app} ${info.version}${info.build ? ` (build ${info.build})` : ''} · ${info.variant} · Expo SDK ${info.sdk ?? '?'} · ${info.jsEngine}`,
    `${info.os} ${info.osVersion}${info.device ? ` · ${info.device}` : ''}`,
    '',
    '### Local data (counts only, no content)',
    ...Object.entries(data).map(([k, v]) => `- ${k}: ${v ?? '?'}`),
    '',
    `### Recent errors and warnings (${logs.length})`,
    ...(logs.length ? logs.map((l) => `- ${l.at.slice(11, 19)} ${l.level.toUpperCase()} ${l.message}`) : ['(none recorded since the app started)']),
  ];
  return lines.filter((l) => l !== null).join('\n');
}
