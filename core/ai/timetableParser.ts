import { GoogleGenAI, Type } from '@google/genai';
import * as FileSystem from 'expo-file-system/legacy';
import { GeminiKey } from '../settings/aiProviders';
import { withGeminiModel } from './geminiModels';
import { readScan, UnreadableTimetable, type ScanData } from '../../domains/timetable/scan';

export type ScanPhase = 'preparing' | 'reading' | 'checking';

const prompt = (section: string, group: string) => `You read a photo of a university class timetable and return its classes as JSON.

1. Layout: days may be rows with periods as columns, or periods as rows with days as columns. Read the header row and first column to tell which, then walk one day at a time.
2. Times: map each cell to its period header and use the period's real start and end time (e.g. "08:55 AM"). A merged cell spanning several periods (a 2-hour lab) runs from the first period's start to the last period's end. Times are "hh:mm AM/PM".
3. Empty cells are free time. Skip them.
4. A cell like "ES-L" is a lecture (theory), "-T" a tutorial, "Lab" or "-P" a lab. The part before the suffix is the course code. Also read the room (e.g. JCB-213) and faculty initials (e.g. VF-5) when shown.
5. Some cells are split between lab/tutorial groups (e.g. "SC Lab CSE-2 / CN Lab CSE-1"). Return one class per group and put the group name in "group". Classes for the whole section have no group.
6. ${section ? `If the photo shows several sections, read only "${section}".` : 'If the photo shows several sections, read the first one.'}${group ? ` The student is in group "${group}", but still return every group's classes.` : ''}
7. "legend": the table that maps course codes to full course names, if the photo has one.
8. "groups": every lab/tutorial group name that appears in the timetable.
9. If the photo is not a timetable, return an empty "classes" list.`;

const schema = {
  type: Type.OBJECT,
  properties: {
    groups: { type: Type.ARRAY, items: { type: Type.STRING } },
    legend: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { code: { type: Type.STRING }, name: { type: Type.STRING } }, required: ['code', 'name'] },
    },
    classes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
          startTime: { type: Type.STRING, description: 'hh:mm AM/PM, e.g. 08:00 AM' },
          endTime: { type: Type.STRING, description: 'hh:mm AM/PM, e.g. 08:55 AM' },
          subjectCode: { type: Type.STRING, description: 'Course code, e.g. ES, CN, PCC-CSE301' },
          type: { type: Type.STRING, enum: ['theory', 'lab', 'tutorial'] },
          group: { type: Type.STRING, nullable: true, description: 'Lab/tutorial group, e.g. CSE-2; empty for the whole section' },
          venue: { type: Type.STRING, nullable: true },
          faculty: { type: Type.STRING, nullable: true },
        },
        required: ['day', 'startTime', 'endTime', 'subjectCode', 'type'],
      },
    },
  },
  required: ['classes'],
};

/**
 * Read a timetable photo with the student's own Gemini key (design UniScan).
 * Returns every class with its group so the review can switch groups without
 * another request. Throws `UnreadableTimetable` when no timetable comes back;
 * other errors are Gemini's own (see `scanErrorKind`). `signal` cancels.
 */
export async function scanTimetable(
  photo: { uri: string; mimeType?: string | null },
  opts: { section: string; group: string; signal?: AbortSignal; onPhase?: (p: ScanPhase) => void },
): Promise<ScanData> {
  const apiKey = await GeminiKey.get();
  if (!apiKey) throw Object.assign(new Error('No Gemini key'), { name: 'NoGeminiKey' });
  opts.onPhase?.('preparing');
  const data = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
  if (opts.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });

  const ai = new GoogleGenAI({ apiKey });
  const listModels = async () => {
    const out: Array<{ name?: string; supportedActions?: string[] }> = [];
    for await (const m of await ai.models.list({ config: { pageSize: 100, abortSignal: opts.signal } })) out.push(m);
    return out;
  };
  opts.onPhase?.('reading');
  const { result, model } = await withGeminiModel((m) => ai.models.generateContent({
    model: m,
    contents: [prompt(opts.section.trim(), opts.group.trim()), { inlineData: { data, mimeType: photo.mimeType || 'image/jpeg' } }],
    config: { responseMimeType: 'application/json', responseSchema: schema, abortSignal: opts.signal },
  }), listModels);
  console.info(`[timetable] read with ${model}`);

  opts.onPhase?.('checking');
  let parsed: unknown;
  try { parsed = JSON.parse(result.text ?? ''); } catch { throw new UnreadableTimetable(); }
  const scan = readScan(parsed);
  if (!scan.classes.length) throw new UnreadableTimetable();
  return scan;
}

/** One cheap call to see whether Google accepts a key. Throws Gemini's error when it doesn't. */
export async function testGeminiKey(apiKey: string): Promise<void> {
  await new GoogleGenAI({ apiKey }).models.list({ config: { pageSize: 1 } });
}
