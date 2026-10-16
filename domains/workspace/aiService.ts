import { WorkspaceRepository } from './repository';
import type { PlannedCourse } from './importPlan';
import { colors } from '../../tokens';

export interface ImportResult { created: Array<{ code: string; name: string; color: string; classes: number }>; skipped: string[]; warnings: string[] }

const palette = () => colors.subjects.map((s) => s.base);

/** The colours the next `n` new courses get: unused palette colours first, then the palette again. */
export function previewColors(n: number, used: string[]): string[] {
  const taken = new Set(used);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = palette().find((x) => !taken.has(x)) ?? palette()[i % palette().length];
    taken.add(c);
    out.push(c);
  }
  return out;
}

export class AITimetableService {
  /**
   * Create one course per reviewed course with all of its weekly slots. Codes
   * already in the app are left untouched, and one failing course never stops
   * the others.
   */
  static async importCourses(courses: Array<PlannedCourse & { name: string }>): Promise<ImportResult> {
    const existing = await WorkspaceRepository.getAllWorkspaces();
    const codes = new Set(existing.map((w) => w.code?.toUpperCase()).filter(Boolean));
    const used = existing.map((w) => w.color).filter((c): c is string => !!c);

    const created: ImportResult['created'] = [];
    const skipped: string[] = [];
    const warnings: string[] = [];
    for (const c of courses) {
      if (codes.has(c.code)) { skipped.push(c.code); continue; }
      const color = previewColors(1, used)[0];
      used.push(color);
      try {
        await WorkspaceRepository.buildCompleteWorkspace({ name: c.name || c.code, code: c.code, credits: c.credits, color, components: c.components });
        codes.add(c.code);
        created.push({ code: c.code, name: c.name || c.code, color, classes: c.components.reduce((n, p) => n + p.sessions.length, 0) });
      } catch (e: any) {
        if (e?.message === 'NO_ACTIVE_SEMESTER') throw new Error('Create or activate a semester first, then scan again.');
        warnings.push(`${c.code}: could not be added (${e?.message ?? e}).`);
      }
    }
    return { created, skipped, warnings };
  }
}
