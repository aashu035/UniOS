/**
 * Picking a Gemini model that the user's API key can actually call.
 *
 * Google retires model names and closes old ones to new keys (gemini-2.5-pro
 * started returning 404 "no longer available to new users"). So instead of one
 * hard-coded name we try a short list, newest-alias first, and if every one is
 * gone we ask the API which models this key can use. The model that worked is
 * remembered for the rest of the session.
 */

/** `-latest` aliases follow Google's current release, so they outlive specific versions. Flash first: it is on the free tier. */
export const GEMINI_CANDIDATES = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];

let remembered: string | null = null;
export const rememberedModel = () => remembered;
export const resetRememberedModel = () => { remembered = null; };

const text = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : e && typeof e === 'object' && typeof (e as any).message === 'string' ? (e as any).message : '') || '';
const status = (e: unknown): number | undefined => (e && typeof e === 'object' && 'status' in e ? Number((e as any).status) : undefined);

/** The model name is unknown, retired or closed to this key: try the next one. */
export function isModelUnavailable(e: unknown): boolean {
  const m = text(e);
  return status(e) === 404 || /NOT_FOUND|no longer available|is not found|not supported for generateContent|does not exist/i.test(m);
}

/**
 * From a ListModels result, the models worth trying for image + JSON extraction:
 * those supporting generateContent, excluding embedding/TTS/image-generation/live
 * variants, newest version first, Flash before Pro (free tier).
 */
export function rankListedModels(models: Array<{ name?: string; supportedActions?: string[] }>): string[] {
  const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  return models
    .filter((m) => m.name && (m.supportedActions ?? ['generateContent']).includes('generateContent'))
    .map((m) => m.name!.replace(/^models\//, ''))
    .filter((n) => /^gemini-/.test(n) && !/embedding|tts|image|live|audio|aqa|robotics|computer-use/i.test(n))
    .sort((a, b) => version(b) - version(a) || Number(/flash/.test(b)) - Number(/flash/.test(a)) || a.localeCompare(b));
}

/** A message a student can act on, instead of the raw JSON error. */
export function friendlyGeminiError(e: unknown): string {
  const m = text(e);
  const s = status(e);
  if (s === 400 && /API key not valid|API_KEY_INVALID/i.test(m)) return 'Your Gemini API key was rejected. Copy it again from aistudio.google.com and save it in Settings → AI API Providers.';
  if (s === 403 || /PERMISSION_DENIED/i.test(m)) return 'This API key is not allowed to use Gemini. Check that the Generative Language API is enabled for its Google Cloud project.';
  if (s === 429 || /RESOURCE_EXHAUSTED|quota/i.test(m)) return 'Gemini says this key is out of quota for now. Wait a minute and try again, or use a key with a higher limit.';
  if (isModelUnavailable(e)) return 'None of the Gemini models this app knows are available to your key right now. Please report this from More → Report a problem.';
  if (/Network request failed|fetch failed|ENOTFOUND|timed out/i.test(m)) return 'Could not reach Gemini. Check your internet connection and try again.';
  return m.length > 300 ? `${m.slice(0, 300)}…` : m || 'Gemini could not read this timetable. Please try again.';
}

/**
 * Run `call` with the first model that exists for this key. Errors other than
 * "model unavailable" (bad key, quota, bad image) stop immediately.
 */
export async function withGeminiModel<T>(
  call: (model: string) => Promise<T>,
  listModels: () => Promise<Array<{ name?: string; supportedActions?: string[] }>>,
): Promise<{ result: T; model: string }> {
  const tried = new Set<string>();
  const attempt = async (names: string[]) => {
    let last: unknown;
    for (const model of names) {
      if (tried.has(model)) continue;
      tried.add(model);
      try {
        const result = await call(model);
        remembered = model;
        return { result, model };
      } catch (e) {
        if (!isModelUnavailable(e)) throw e;
        last = e;
      }
    }
    if (last !== undefined) throw last;
    return null;
  };

  let lastErr: unknown;
  try {
    const hit = await attempt([...(remembered ? [remembered] : []), ...GEMINI_CANDIDATES]);
    if (hit) return hit;
  } catch (e) {
    if (!isModelUnavailable(e)) throw e;
    lastErr = e;
  }
  // Every known name is gone: ask the API what this key can use.
  const listed = rankListedModels(await listModels());
  const hit = await attempt(listed);
  if (hit) return hit;
  throw lastErr ?? new Error('NOT_FOUND: no Gemini model available for this key');
}
