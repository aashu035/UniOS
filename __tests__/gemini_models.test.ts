import { friendlyGeminiError, GEMINI_CANDIDATES, isModelUnavailable, rankListedModels, rememberedModel, resetRememberedModel, withGeminiModel } from '../core/ai/geminiModels';

const gone = Object.assign(new Error('{"error":{"code":404,"message":"This model models/gemini-2.5-pro is no longer available to new users.","status":"NOT_FOUND"}}'), { status: 404 });
const badKey = Object.assign(new Error('API key not valid. Please pass a valid API key.'), { status: 400 });

beforeEach(resetRememberedModel);

describe('gemini model fallback', () => {
  it('recognises the retired-model error from the device', () => {
    expect(isModelUnavailable(gone)).toBe(true);
    expect(isModelUnavailable(badKey)).toBe(false);
  });

  it('skips unavailable models and remembers the one that worked', async () => {
    const calls: string[] = [];
    const out = await withGeminiModel(async (m) => { calls.push(m); if (m !== GEMINI_CANDIDATES[1]) throw gone; return 'ok'; }, async () => []);
    expect(out).toEqual({ result: 'ok', model: GEMINI_CANDIDATES[1] });
    expect(calls).toEqual(GEMINI_CANDIDATES.slice(0, 2));
    expect(rememberedModel()).toBe(GEMINI_CANDIDATES[1]);
  });

  it('asks the API for models when every known name is gone', async () => {
    const listed = [
      { name: 'models/text-embedding-004', supportedActions: ['embedContent'] },
      { name: 'models/gemini-4.0-flash-tts', supportedActions: ['generateContent'] },
      { name: 'models/gemini-4.0-pro', supportedActions: ['generateContent'] },
      { name: 'models/gemini-4.0-flash', supportedActions: ['generateContent'] },
    ];
    const out = await withGeminiModel(async (m) => { if (!m.startsWith('gemini-4.0')) throw gone; return m; }, async () => listed);
    expect(out.model).toBe('gemini-4.0-flash');
  });

  it('stops at once on a bad key instead of trying every model', async () => {
    let n = 0;
    await expect(withGeminiModel(async () => { n++; throw badKey; }, async () => [])).rejects.toBe(badKey);
    expect(n).toBe(1);
  });

  it('fails clearly when nothing is available', async () => {
    await expect(withGeminiModel(async () => { throw gone; }, async () => [])).rejects.toBe(gone);
  });

  it('ranks newest first, Flash before Pro, without non-chat variants', () => {
    expect(rankListedModels([
      { name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-3.1-pro-preview' }, { name: 'models/gemini-3.1-flash' },
      { name: 'models/gemini-2.5-flash-image' }, { name: 'models/gemma-3-27b-it' },
    ])).toEqual(['gemini-3.1-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash']);
  });

  it('turns raw API errors into plain advice', () => {
    expect(friendlyGeminiError(badKey)).toMatch(/key was rejected/);
    expect(friendlyGeminiError(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }))).toMatch(/out of quota/);
    expect(friendlyGeminiError(new Error('Network request failed'))).toMatch(/internet/);
    expect(friendlyGeminiError(gone)).not.toMatch(/\{"error"/);
  });
});
