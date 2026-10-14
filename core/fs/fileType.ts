/**
 * The extension a picked file is saved under, which decides its viewer. The
 * name alone is not enough: downloads are often named without one
 * ("Video by nandan.sharma23 [DZdbo]") or with a misleading one, while the
 * picker always reports the real type ("video/mp4").
 */
const BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/amr': 'amr',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md', 'application/json': 'json', 'application/epub+zip': 'epub', 'application/zip': 'zip',
};
const KNOWN = new Set([...Object.values(BY_MIME), 'jpeg', 'm4v', 'odt', 'ods', 'odp', 'rtf']);

export function extensionFor(name: string, mimeType?: string | null): string {
  const fromName = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim())?.[1]?.toLowerCase();
  if (fromName && KNOWN.has(fromName)) return fromName;
  const fromMime = mimeType ? BY_MIME[mimeType.toLowerCase().split(';')[0].trim()] : undefined;
  return fromMime ?? fromName ?? 'bin';
}
