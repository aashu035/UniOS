import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { expoDb } from '../db/client';
import { formatReport, LogBuffer, type AppInfo } from './report';

export const recentLogs = new LogBuffer();
let installed = false;

/** Mirror console errors/warnings and uncaught JS errors into the report buffer. Call once at startup. */
export function installDiagnostics() {
  if (installed) return;
  installed = true;
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a: unknown[]) => { recentLogs.add('error', a); origError(...a); };
  console.warn = (...a: unknown[]) => { recentLogs.add('warn', a); origWarn(...a); };

  const g = globalThis as any;
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    recentLogs.add('error', [isFatal ? '[fatal]' : '[uncaught]', error]);
    prev?.(error, isFatal);
  });
}

export const appVariant = (): string => (Constants.expoConfig?.extra as any)?.appVariant ?? (__DEV__ ? 'development' : 'production');

export function appInfo(): AppInfo {
  const pc = Platform.constants as any;
  return {
    app: Constants.expoConfig?.name ?? 'UniOS',
    version: Constants.expoConfig?.version ?? '?',
    build: Platform.OS === 'android' ? String(Constants.expoConfig?.android?.versionCode ?? '') || null : Constants.expoConfig?.ios?.buildNumber ?? null,
    variant: appVariant(),
    sdk: Constants.expoConfig?.sdkVersion ?? null,
    os: Platform.OS,
    osVersion: String(Platform.Version),
    device: [pc?.Manufacturer, pc?.Model].filter(Boolean).join(' ') || null,
    jsEngine: (globalThis as any).HermesInternal ? 'Hermes' : 'JSC',
  };
}

const COUNTED = ['semesters', 'workspaces', 'course_components', 'recurring_schedules', 'schedule_exceptions', 'attendance', 'tasks', 'resources', 'portal_attendance'];

/** Row counts and migration state. Never reads row contents. */
export async function dataSummary(): Promise<Record<string, number | string | null>> {
  const out: Record<string, number | string | null> = {};
  for (const t of COUNTED) {
    try { out[t] = ((await expoDb.getFirstAsync(`SELECT COUNT(*) AS n FROM ${t}`)) as any)?.n ?? 0; } catch { out[t] = null; }
  }
  try {
    const m = (await expoDb.getFirstAsync('SELECT COUNT(*) AS n, MAX(created_at) AS last FROM __drizzle_migrations')) as any;
    out.migrations = m ? `${m.n} applied` : null;
  } catch { out.migrations = null; }
  return out;
}

export async function buildReport(note?: string, screen?: string | null): Promise<string> {
  return formatReport({ info: appInfo(), data: await dataSummary(), logs: recentLogs.list(), note, screen });
}

/** Send a user report to Sentry with the diagnostics attached. Returns the event id. */
export async function sendReport(note: string, email?: string, screen?: string | null): Promise<string> {
  const report = await buildReport(note, screen);
  return Sentry.captureFeedback(
    { message: note.trim() || 'No description', email: email?.trim() || undefined, source: 'in-app-report', tags: { variant: appVariant(), screen: screen ?? 'unknown' } },
    { attachments: [{ filename: 'diagnostics.md', data: report, contentType: 'text/markdown' }], includeReplay: true },
  );
}
