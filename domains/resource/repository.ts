import { db } from '../../core/db/client';
import { isStoredUpload } from '../../core/fs/names';
import { resources } from './model';
import { workspaces } from '../workspace/model';
import { eq, desc } from 'drizzle-orm';
import { checkLink, linkTitle, noteTitle } from './files';

type Row = typeof resources.$inferSelect;
const NOTE_MAX = 200_000;

export class ResourceRepository {
  static async getResourcesForWorkspace(workspaceId: number) {
    return await db.select()
      .from(resources)
      .where(eq(resources.workspaceId, workspaceId))
      .orderBy(desc(resources.createdAt));
  }

  static get(id: number): Row | undefined {
    return db.select().from(resources).where(eq(resources.id, id)).get();
  }

  /** Every saved file of a course, oldest first (the photo viewer swipes through these). */
  static listFilesFor(workspaceId: number): Row[] {
    return db.select().from(resources).where(eq(resources.workspaceId, workspaceId)).orderBy(resources.id).all();
  }

  /** The first saved file with this SHA-256, with its course name, for the duplicate check. */
  static findByHash(hash: string): { title: string; uri: string | null; course: string } | null {
    const r = db.select({ title: resources.title, uri: resources.uri, course: workspaces.name })
      .from(resources).leftJoin(workspaces, eq(resources.workspaceId, workspaces.id))
      .where(eq(resources.fileHash, hash)).limit(1).get();
    return r ? { title: r.title, uri: r.uri, course: r.course ?? 'General' } : null;
  }

  static addFile(f: { workspaceId: number | null; title: string; uri: string; hash: string; sizeBytes: number }): number {
    if (!isStoredUpload(f.uri)) throw new Error('That is not a file this app stored.');
    return db.insert(resources).values({
      workspaceId: f.workspaceId, title: f.title.slice(0, 200), uri: f.uri, type: 'file', textContent: '', fileHash: f.hash, sizeBytes: f.sizeBytes,
    }).returning({ id: resources.id }).get()!.id;
  }

  static addLink(l: { workspaceId: number | null; title: string; url: string }): number {
    const url = checkLink(l.url);
    if (!url) throw new Error('Check the link. It should start with https://');
    return db.insert(resources).values({ workspaceId: l.workspaceId, title: linkTitle(l.title, url), uri: url, type: 'link' }).returning({ id: resources.id }).get()!.id;
  }

  static createNote(n: { workspaceId: number | null; title: string; text: string }): number {
    return db.insert(resources).values({ workspaceId: n.workspaceId, title: noteTitle(n.title).slice(0, 200), type: 'note', uri: null, textContent: n.text.slice(0, NOTE_MAX) })
      .returning({ id: resources.id }).get()!.id;
  }

  static updateNote(id: number, n: { title: string; text: string }) {
    db.update(resources).set({ title: noteTitle(n.title).slice(0, 200), textContent: n.text.slice(0, NOTE_MAX) }).where(eq(resources.id, id)).run();
  }

  static rename(id: number, title: string) {
    const t = title.trim().slice(0, 200);
    if (!t) throw new Error('Enter a name.');
    db.update(resources).set({ title: t }).where(eq(resources.id, id)).run();
  }

  static move(id: number, workspaceId: number | null) {
    db.update(resources).set({ workspaceId }).where(eq(resources.id, id)).run();
  }

  /**
   * Delete the row and return it for Undo. The stored file stays until
   * `purgeLater` runs, so Undo brings back a working file.
   */
  static remove(id: number): Row | null {
    const row = ResourceRepository.get(id) ?? null;
    if (row) db.delete(resources).where(eq(resources.id, id)).run();
    return row;
  }

  /** Undo a delete: the same row and id. */
  static restore(row: Row) {
    db.insert(resources).values(row).onConflictDoNothing().run();
  }

  /** After the Undo window, delete the file if no row uses it any more. */
  static purgeLater(uri: string | null | undefined, ms = 5500) {
    if (!isStoredUpload(uri)) return;
    setTimeout(() => { ResourceRepository.removeFileIfUnused(uri).catch((e) => console.error('Could not delete the file', e)); }, ms);
  }

  /**
   * Delete a stored file once no resource row points at it. Uploads are kept in
   * the app's resources folder under a bare filename (`<uuid>.pdf`), and identical
   * uploads share one file, so a file is only removed when its last row is gone.
   * Links, notes and anything that isn't a name the app gave an upload are left alone.
   */
  static async removeFileIfUnused(uri: string | null | undefined) {
    if (!isStoredUpload(uri)) return;
    const stillUsed = db.select({ id: resources.id }).from(resources).where(eq(resources.uri, uri)).limit(1).all();
    if (stillUsed.length) return;
    const { FileManager } = require('../../core/fs/FileManager');
    await FileManager.deleteFile(uri);
  }
}
