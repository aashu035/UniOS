import { ParsedClassSession, TimetableParser } from '../../core/ai/timetableParser';
import { WorkspaceRepository } from './repository';
import { planImport } from './importPlan';
import { colors } from '../../tokens';

export interface ImportResult { sessions: ParsedClassSession[]; created: string[]; skipped: string[]; warnings: string[] }

export class AITimetableService {
  /**
   * Scan the image and create one course per subject with all of its weekly
   * slots. Subjects that already exist (same course code) are left untouched,
   * and one failing course never stops the others.
   */
  static async importTimetable(imageUri: string, userBatch: string): Promise<ImportResult> {
    const sessions = await TimetableParser.parseTimetableImage(imageUri, userBatch);
    const { courses, warnings } = planImport(sessions);

    const existing = await WorkspaceRepository.getAllWorkspaces();
    const codes = new Set(existing.map((w) => w.code?.toUpperCase()).filter(Boolean));
    const used = new Set(existing.map((w) => w.color));
    const palette = colors.subjects.map((s) => s.base);

    const created: string[] = [];
    const skipped: string[] = [];
    for (const c of courses) {
      if (codes.has(c.code)) { skipped.push(c.code); continue; }
      const color = palette.find((x) => !used.has(x)) ?? palette[created.length % palette.length];
      used.add(color);
      try {
        await WorkspaceRepository.buildCompleteWorkspace({ name: c.code, code: c.code, credits: c.credits, color, components: c.components });
        created.push(c.code);
      } catch (e: any) {
        if (e?.message === 'NO_ACTIVE_SEMESTER') throw new Error('Create or activate a semester first, then scan again.');
        warnings.push(`${c.code}: could not be added (${e?.message ?? e}).`);
      }
    }
    return { sessions, created, skipped, warnings };
  }
}
