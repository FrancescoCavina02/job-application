/**
 * Sanitizes a string for use as a filename component.
 * Replaces spaces with underscores, removes filesystem-unsafe characters.
 */
export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/^\.+/, '')
    .slice(0, 100) // guard against excessively long names
    || 'Unknown_Company';
}
