/**
 * Names the app itself gives files in its own storage. Anything that reaches a
 * file operation from a backup, deep link or the database must match one of
 * these, because the native file layer percent-decodes paths ("%2E%2E%2F" is
 * "../") and resolves "." and "SQLite" against the app's private folder.
 */

/** Uploads: `<uuid v4>.<extension of the original file>` (FileManager.saveFile). */
const UPLOAD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[^/\\:%]{1,64}$/i;
/** Profile photo: `avatar_<timestamp>.jpg` (app/profile/edit.tsx). */
const AVATAR = /^avatar_\d{1,16}\.jpg$/;

export const isStoredUpload = (name: unknown): name is string => typeof name === 'string' && UPLOAD.test(name);
export const isOwnAvatar = (name: unknown): name is string => typeof name === 'string' && AVATAR.test(name);
export const isWebLink = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\/[^\s]+$/i.test(s);
/** In-app routes from notifications: "/course/3", never "//host" or "scheme:". */
export const isAppRoute = (s: unknown): s is string => typeof s === 'string' && /^\/(?!\/)[^\s:]*$/.test(s);
